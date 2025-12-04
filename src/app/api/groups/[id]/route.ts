import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { groups, groupMembers, images } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { updateGroupSchema, parseFormData } from "@/lib/validations";
import { uploadImage } from "@/lib/upload";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const group = await db.query.groups.findFirst({
      where: eq(groups.id, id),
      with: {
        members: {
          with: {
            user: true,
          },
        },
        categories: true,
        transactions: true,
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
    }

    // Verificar se o usuário é membro
    const isMember = group.members.some(m => m.userId === authUser.userId);
    if (!isMember) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Buscar URL da imagem do grupo se existir
    let photoUrl: string | null = null;
    if (group.photoId) {
      const image = await db.query.images.findFirst({
        where: eq(images.id, group.photoId),
      });
      photoUrl = image?.path || null;
    }

    // Buscar fotos dos membros
    const membersWithPhotos = await Promise.all(
      group.members.map(async (member) => {
        let memberPhotoUrl: string | null = null;
        if (member.user.photoId) {
          const photo = await db.query.images.findFirst({
            where: eq(images.id, member.user.photoId),
          });
          memberPhotoUrl = photo?.path || null;
        }

        return {
          id: member.id,
          userId: member.userId,
          isAdmin: member.isAdmin,
          joinedAt: member.joinedAt,
          user: {
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
            photoUrl: memberPhotoUrl,
          },
        };
      })
    );

    // Calcular saldo do grupo baseado nas transações pagas
    const groupBalance = group.transactions
      .filter(tx => tx.isPaid)
      .reduce((sum, tx) => {
        const amount = parseFloat(tx.amount) || 0;
        return sum + (tx.type === "income" ? amount : -amount);
      }, 0);

    return NextResponse.json({
      id: group.id,
      name: group.name,
      description: group.description,
      photoUrl,
      ownerId: group.ownerId,
      balance: groupBalance,
      members: membersWithPhotos,
      categories: group.categories,
      transactions: group.transactions,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    });
  } catch (error) {
    console.error("Get group error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(
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

    // Verificar se o usuário é o dono do grupo
    if (group.ownerId !== authUser.userId) {
      return NextResponse.json(
        { error: "Apenas o dono pode editar o grupo" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const validatedData = parseFormData(updateGroupSchema, formData);

    const updateData: any = { updatedAt: new Date() };

    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.description) updateData.description = validatedData.description;

    if (validatedData.photo) {
      const uploadedImage = await uploadImage(validatedData.photo);
      updateData.photoId = uploadedImage.id;
    }

    const [updatedGroup] = await db
      .update(groups)
      .set(updateData)
      .where(eq(groups.id, groupId))
      .returning();

    return NextResponse.json(updatedGroup);
  } catch (error: any) {
    console.error("Update group error:", error);
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: groupId } = await params;

    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
    }

    if (group.ownerId !== authUser.userId) {
      return NextResponse.json(
        { error: "Apenas o dono pode deletar o grupo" },
        { status: 403 }
      );
    }

    await db.delete(groups).where(eq(groups.id, groupId));

    return NextResponse.json({ message: "Grupo deletado com sucesso" });
  } catch (error) {
    console.error("Delete group error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
