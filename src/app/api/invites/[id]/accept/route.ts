import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { groupInvites, groupMembers, users } from "@/db/schema";
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

    const { id: inviteId } = await params;

    // Buscar o convite
    const invite = await db.query.groupInvites.findFirst({
      where: eq(groupInvites.id, inviteId),
    });

    if (!invite) {
      return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Este convite já foi processado" }, { status: 400 });
    }

    // Buscar usuário pelo email do convite
    const user = await db.query.users.findFirst({
      where: eq(users.id, authUser.userId),
    });

    if (!user || user.email !== invite.invitedEmail) {
      return NextResponse.json({ error: "Este convite não é para você" }, { status: 403 });
    }

    // Verificar se o usuário já é membro
    const existingMembership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, invite.groupId),
        eq(groupMembers.userId, authUser.userId)
      ),
    });

    if (existingMembership) {
      // Atualizar convite para aceito mesmo que já seja membro
      await db
        .update(groupInvites)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(groupInvites.id, inviteId));

      return NextResponse.json({ message: "Você já é membro deste grupo" });
    }

    // Adicionar usuário como membro do grupo
    await db.insert(groupMembers).values({
      groupId: invite.groupId,
      userId: authUser.userId,
      isAdmin: false,
    });

    // Atualizar status do convite
    await db
      .update(groupInvites)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(groupInvites.id, inviteId));

    return NextResponse.json({ message: "Convite aceito com sucesso" });
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
