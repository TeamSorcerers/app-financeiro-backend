import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { groupInvites, groups, groupMembers, users } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { inviteMemberSchema } from "@/lib/validations";
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

    // Verificar se o grupo existe
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
    }

    // Verificar se o usuário é membro do grupo
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, authUser.userId)
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: "Você não é membro deste grupo" }, { status: 403 });
    }

    // Validar dados
    const body = await request.json();
    const validatedData = inviteMemberSchema.parse(body);

    // Verificar se o email já é membro do grupo
    const invitedUser = await db.query.users.findFirst({
      where: eq(users.email, validatedData.email),
    });

    if (invitedUser) {
      const existingMembership = await db.query.groupMembers.findFirst({
        where: and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, invitedUser.id)
        ),
      });

      if (existingMembership) {
        return NextResponse.json({ error: "Este usuário já é membro do grupo" }, { status: 400 });
      }
    }

    // Verificar se já existe um convite pendente para este email
    const existingInvite = await db.query.groupInvites.findFirst({
      where: and(
        eq(groupInvites.groupId, groupId),
        eq(groupInvites.invitedEmail, validatedData.email),
        eq(groupInvites.status, "pending")
      ),
    });

    if (existingInvite) {
      return NextResponse.json({ error: "Já existe um convite pendente para este email" }, { status: 400 });
    }

    // Criar convite
    const [newInvite] = await db.insert(groupInvites).values({
      groupId,
      invitedBy: authUser.userId,
      invitedEmail: validatedData.email,
      status: "pending",
    }).returning();

    return NextResponse.json({
      message: "Convite enviado com sucesso",
      invite: newInvite,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Create invite error:", error);
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
