import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { createCardSchema } from "@/lib/validations";
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
    const validatedData = createCardSchema.parse(body);

    const [updated] = await db.update(cards)
      .set({
        name: validatedData.name,
        type: validatedData.type,
        balance: validatedData.balance.toString(),
        limit: validatedData.limit ? validatedData.limit.toString() : null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(cards.id, id),
        eq(cards.userId, authUser.userId)
      ))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });
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

    await db.delete(cards)
      .where(and(
        eq(cards.id, id),
        eq(cards.userId, authUser.userId)
      ));

    return NextResponse.json({ message: "Cartão removido com sucesso" });
  } catch (error) {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
