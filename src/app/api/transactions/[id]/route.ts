import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { updateTransactionSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

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
    const validatedData = updateTransactionSchema.parse(body);

    const updateData: any = {
      description: validatedData.description,
      amount: typeof validatedData.amount === 'string' 
        ? parseFloat(validatedData.amount).toString() 
        : validatedData.amount.toString(),
      type: validatedData.type,
      date: new Date(validatedData.date),
      category: validatedData.category,
      categoryEmoji: validatedData.categoryEmoji || null,
      paymentMethod: validatedData.paymentMethod || null,
      paymentMethodId: validatedData.paymentMethodId || null,
      paymentMethodName: validatedData.paymentMethodName || null,
      scheduledDate: validatedData.scheduledDate ? new Date(validatedData.scheduledDate) : null,
      isPaid: validatedData.isPaid ?? true,
      installmentTotal: validatedData.installments?.total || null,
      installmentCurrent: validatedData.installments?.current || null,
      updatedAt: new Date(),
    };

    const [updatedTransaction] = await db.update(transactions)
      .set(updateData)
      .where(eq(transactions.id, id))
      .returning();

    if (!updatedTransaction) {
      return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
    }

    return NextResponse.json(updatedTransaction);
  } catch (error: any) {
    console.error("Update transaction error:", error);
    
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

    await db.delete(transactions).where(eq(transactions.id, id));

    return NextResponse.json({ message: "Transação removida com sucesso" });
  } catch (error) {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
