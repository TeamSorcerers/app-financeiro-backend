import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { groupInvites, groups, users } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, authUser.userId),
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Buscar convites pendentes para o email do usuário
    const userInvites = await db.query.groupInvites.findMany({
      where: and(
        eq(groupInvites.invitedEmail, user.email),
        eq(groupInvites.status, "pending")
      ),
      with: {
        group: true,
        inviter: true,
      },
    });

    const transformedInvites = userInvites.map(invite => ({
      id: invite.id,
      groupId: invite.groupId,
      groupName: invite.group.name,
      invitedBy: invite.inviter.name,
      invitedEmail: invite.invitedEmail,
      status: invite.status,
      createdAt: invite.createdAt,
      updatedAt: invite.updatedAt,
    }));

    return NextResponse.json(transformedInvites);
  } catch (error) {
    console.error("Get invites error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" }, 
      { status: 500 }
    );
  }
}
