import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { groups, groupMembers } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function POST(
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

    // Verificar se o usuário autenticado é o dono do grupo
    if (group.ownerId !== authUser.userId) {
      return NextResponse.json(
        { error: "Apenas o dono do grupo pode remover cargo de administrador" },
        { status: 403 }
      );
    }

    // Não permitir que o dono remova seu próprio cargo
    if (memberUserId === authUser.userId) {
      return NextResponse.json(
        { error: "O dono do grupo não pode remover seu próprio cargo de administrador" },
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

    // Verificar se é admin
    if (!member.isAdmin) {
      return NextResponse.json(
        { error: "Membro não é administrador" },
        { status: 400 }
      );
    }

    // Remover cargo de administrador
    await db
      .update(groupMembers)
      .set({ isAdmin: false })
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, memberUserId)
        )
      );

    return NextResponse.json({ 
      message: "Cargo de administrador removido com sucesso" 
    });
  } catch (error) {
    console.error("Demote member error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
