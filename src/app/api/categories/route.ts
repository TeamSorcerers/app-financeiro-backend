import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { createCategorySchema } from "@/lib/validations";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userCategories = await db.query.categories.findMany({
      where: eq(categories.userId, authUser.userId),
    });

    return NextResponse.json(userCategories);
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
    const validatedData = createCategorySchema.parse(body);

    const [newCategory] = await db.insert(categories).values({
      userId: authUser.userId,
      name: validatedData.name,
      emoji: validatedData.emoji,
      type: validatedData.type,
    }).returning();

    return NextResponse.json(newCategory, { status: 201 });
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
