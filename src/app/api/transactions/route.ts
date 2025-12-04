import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { createTransactionSchema } from "@/lib/validations";
import { eq, and, desc, isNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const groupId = searchParams.get("groupId");

    let userTransactions;
    
    if (groupId) {
      userTransactions = await db.query.transactions.findMany({
        where: eq(transactions.groupId, groupId),
        orderBy: [desc(transactions.date)],
      });
    } else {
      userTransactions = await db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, authUser.userId),
          isNull(transactions.groupId)
        ),
        orderBy: [desc(transactions.date)],
      });
    }

    return NextResponse.json(userTransactions);
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
    const validatedData = createTransactionSchema.parse(body);

    const [newTransaction] = await db.insert(transactions).values({
      userId: authUser.userId,
      groupId: validatedData.groupId || null,
      description: validatedData.description,
      amount: validatedData.amount.toString(),
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
      userName: validatedData.userName || null,
    }).returning();

    return NextResponse.json(newTransaction, { status: 201 });
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
