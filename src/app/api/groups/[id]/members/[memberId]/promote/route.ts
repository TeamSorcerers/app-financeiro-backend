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

    // Await params
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
        { error: "Apenas o dono do grupo pode promover membros a administrador" },
        { status: 403 }
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

    // Verificar se já é admin
    if (member.isAdmin) {
      return NextResponse.json(
        { error: "Membro já é administrador" },
        { status: 400 }
      );
    }

    // Promover a administrador
    await db
      .update(groupMembers)
      .set({ isAdmin: true })
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, memberUserId)
        )
      );

    return NextResponse.json({ 
      message: "Membro promovido a administrador com sucesso" 
    });
  } catch (error) {
    console.error("Promote member error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
