import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { groups, groupMembers, groupCategories, transactions, images } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { createGroupSchema, parseFormData } from "@/lib/validations";
import { uploadImage } from "@/lib/upload";
import { DEFAULT_GROUP_CATEGORIES } from "@/lib/defaultCategories";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    console.log("Fetching groups for user:", authUser.userId);

    // Buscar grupos onde o usuário é membro
    const userGroups = await db.query.groups.findMany({
      with: {
        members: {
          with: {
            user: true,
          },
        },
        categories: true,
        transactions: {
          orderBy: [desc(transactions.date)],
        },
      },
    });

    console.log(`Found ${userGroups.length} total groups`);

    // Filtrar apenas grupos onde o usuário é membro
    const filteredGroups = userGroups.filter(group =>
      group.members.some(member => member.userId === authUser.userId)
    );

    console.log(`User is member of ${filteredGroups.length} groups`);

    // Buscar URLs das imagens para cada grupo e processar membros
    const groupsWithImages = await Promise.all(
      filteredGroups.map(async (group) => {
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

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          photoUrl,
          ownerId: group.ownerId,
          balance: groupBalance,
          memberIds: group.members.map(m => m.userId),
          adminIds: group.members.filter(m => m.isAdmin).map(m => m.userId),
          members: membersWithPhotos,
          categories: group.categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            emoji: cat.emoji,
            type: cat.type,
          })),
          transactions: group.transactions.map(tx => ({
            id: tx.id,
            description: tx.description,
            amount: Number(tx.amount),
            type: tx.type,
            date: tx.date,
            category: tx.category,
            categoryEmoji: tx.categoryEmoji,
            paymentMethod: tx.paymentMethod,
            paymentMethodId: tx.paymentMethodId,
            paymentMethodName: tx.paymentMethodName,
            scheduledDate: tx.scheduledDate,
            isPaid: tx.isPaid,
            installments: tx.installmentTotal ? {
              total: tx.installmentTotal,
              current: tx.installmentCurrent || 1,
            } : undefined,
            userName: tx.userName,
            userId: tx.userId,
          })),
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
        };
      })
    );

    return NextResponse.json(groupsWithImages);
  } catch (error) {
    console.error("Get groups error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor", details: error instanceof Error ? error.message : "Unknown error" }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    const validatedData = parseFormData(createGroupSchema, formData);

    let photoId: string | null = null;
    if (validatedData.photo) {
      const uploadedImage = await uploadImage(validatedData.photo);
      photoId = uploadedImage.id;
    }

    // Criar grupo
    const [newGroup] = await db.insert(groups).values({
      name: validatedData.name,
      description: validatedData.description,
      photoId,
      ownerId: authUser.userId,
    }).returning();

    // Adicionar criador como membro e admin
    await db.insert(groupMembers).values({
      groupId: newGroup.id,
      userId: authUser.userId,
      isAdmin: true,
    });

    // Adicionar categorias padrão do grupo
    await db.insert(groupCategories).values(
      DEFAULT_GROUP_CATEGORIES.map(cat => ({
        groupId: newGroup.id,
        name: cat.name,
        emoji: cat.emoji,
        type: cat.type,
      }))
    );

    return NextResponse.json(newGroup, { status: 201 });
  } catch (error: any) {
    console.error("Create group error:", error);
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
