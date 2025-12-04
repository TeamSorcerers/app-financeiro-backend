import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { groups, groupMembers } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: groupId } = await params;

    // Buscar o grupo
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      with: {
        members: true,
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
    }

    // Verificar se o usuário é membro
    const membership = group.members.find(m => m.userId === authUser.userId);
    if (!membership) {
      return NextResponse.json({ error: "Você não é membro deste grupo" }, { status: 403 });
    }

    // Verificar se é o dono do grupo
    const isOwner = group.ownerId === authUser.userId;

    if (isOwner) {
      // Se for o dono, precisa transferir a propriedade
      const body = await request.json();
      const { newOwnerId } = body;

      if (!newOwnerId) {
        return NextResponse.json({ error: "É necessário escolher um novo dono antes de sair" }, { status: 400 });
      }

      // Verificar se o novo dono é membro do grupo
      const newOwnerMembership = group.members.find(m => m.userId === newOwnerId);
      if (!newOwnerMembership) {
        return NextResponse.json({ error: "O novo dono deve ser um membro do grupo" }, { status: 400 });
      }

      // Transferir propriedade
      await db
        .update(groups)
        .set({ ownerId: newOwnerId })
        .where(eq(groups.id, groupId));

      // Promover novo dono a admin se ainda não for
      if (!newOwnerMembership.isAdmin) {
        await db
          .update(groupMembers)
          .set({ isAdmin: true })
          .where(and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, newOwnerId)
          ));
      }
    }

    // Remover o usuário do grupo
    await db
      .delete(groupMembers)
      .where(and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, authUser.userId)
      ));

    return NextResponse.json({ message: "Você saiu do grupo com sucesso" });
  } catch (error) {
    console.error("Leave group error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
