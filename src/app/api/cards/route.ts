import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { createCardSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userCards = await db.query.cards.findMany({
      where: eq(cards.userId, authUser.userId),
    });

    return NextResponse.json(userCards);
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
    const validatedData = createCardSchema.parse(body);

    const [newCard] = await db.insert(cards).values({
      userId: authUser.userId,
      name: validatedData.name,
      type: validatedData.type,
      balance: validatedData.balance.toString(),
      limit: validatedData.limit ? validatedData.limit.toString() : null,
    }).returning();

    return NextResponse.json(newCard, { status: 201 });
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
