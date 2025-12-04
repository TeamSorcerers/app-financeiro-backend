import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { groupCategories, groupMembers } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: groupId, categoryId } = await params;

    // Verificar se o usuário é admin do grupo
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, authUser.userId)
      ),
    });

    if (!membership || !membership.isAdmin) {
      return NextResponse.json({ error: "Apenas administradores podem editar categorias" }, { status: 403 });
    }

    const body = await request.json();
    const { name, emoji, type } = body;

    if (!name || !emoji || !type) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const [updatedCategory] = await db
      .update(groupCategories)
      .set({ name, emoji, type })
      .where(and(
        eq(groupCategories.id, categoryId),
        eq(groupCategories.groupId, groupId)
      ))
      .returning();

    if (!updatedCategory) {
      return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });
    }

    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.error("Update group category error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: groupId, categoryId } = await params;

    // Verificar se o usuário é admin do grupo
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, authUser.userId)
      ),
    });

    if (!membership || !membership.isAdmin) {
      return NextResponse.json({ error: "Apenas administradores podem excluir categorias" }, { status: 403 });
    }

    await db
      .delete(groupCategories)
      .where(and(
        eq(groupCategories.id, categoryId),
        eq(groupCategories.groupId, groupId)
      ));

    return NextResponse.json({ message: "Categoria excluída com sucesso" });
  } catch (error) {
    console.error("Delete group category error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
