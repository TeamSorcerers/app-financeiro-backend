import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bankAccounts } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { createBankAccountSchema } from "@/lib/validations";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createBankAccountSchema.parse(body);

    const [updated] = await db.update(bankAccounts)
      .set({
        name: validatedData.name,
        type: validatedData.type,
        balance: validatedData.balance.toString(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(bankAccounts.id, id),
        eq(bankAccounts.userId, authUser.userId)
      ))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    return NextResponse.json(updated);
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    await db.delete(bankAccounts)
      .where(and(
        eq(bankAccounts.id, id),
        eq(bankAccounts.userId, authUser.userId)
      ));

    return NextResponse.json({ message: "Conta removida com sucesso" });
  } catch (error) {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
