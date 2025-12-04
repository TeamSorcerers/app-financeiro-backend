import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { groups, groupMembers } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: groupId, memberId: memberUserId } = await params;

    // Verificar se o grupo existe
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
    }

    // Verificar se o usuário autenticado é admin do grupo
    const authMember = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, authUser.userId)
      ),
    });

    if (!authMember?.isAdmin && group.ownerId !== authUser.userId) {
      return NextResponse.json(
        { error: "Apenas administradores podem remover membros" },
        { status: 403 }
      );
    }

    // Não permitir remover o dono do grupo
    if (memberUserId === group.ownerId) {
      return NextResponse.json(
        { error: "Não é possível remover o dono do grupo" },
        { status: 400 }
      );
    }

    // Verificar se o membro existe no grupo
    const member = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, memberUserId)
      ),
    });

    if (!member) {
      return NextResponse.json(
        { error: "Membro não encontrado no grupo" },
        { status: 404 }
      );
    }

    // Remover membro do grupo
    await db
      .delete(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, memberUserId)
        )
      );

    return NextResponse.json({ 
      message: "Membro removido do grupo com sucesso" 
    });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
