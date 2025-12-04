import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bankAccounts } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { createBankAccountSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const accounts = await db.query.bankAccounts.findMany({
      where: eq(bankAccounts.userId, authUser.userId),
    });

    return NextResponse.json(accounts);
  } catch (error) {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createBankAccountSchema.parse(body);

    const [newAccount] = await db.insert(bankAccounts).values({
      userId: authUser.userId,
      name: validatedData.name,
      type: validatedData.type,
      balance: validatedData.balance.toString(),
    }).returning();

    return NextResponse.json(newAccount, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
