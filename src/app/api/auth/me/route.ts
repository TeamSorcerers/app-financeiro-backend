import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, images } from "@/db/schema";
import { getAuthUser, hashPassword } from "@/lib/auth";
import { updateUserSchema, parseFormData } from "@/lib/validations";
import { uploadImage } from "@/lib/upload";
import { eq } from "drizzle-orm";

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

    // Buscar photoUrl se existir photoId
    let photoUrl: string | null = null;
    if (user.photoId) {
      const photo = await db.query.images.findFirst({
        where: eq(images.id, user.photoId),
      });
      photoUrl = photo?.path || null;
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      photoUrl,
    });
  } catch (error) {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    
    // Validar com Zod
    const validatedData = parseFormData(updateUserSchema, formData);

    const updateData: any = { updatedAt: new Date() };
    
    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.email) updateData.email = validatedData.email;
    if (validatedData.password) {
      updateData.password = await hashPassword(validatedData.password);
    }

    let photoUrl: string | null = null;
    if (validatedData.photo) {
      const uploadedImage = await uploadImage(validatedData.photo);
      updateData.photoId = uploadedImage.id;
      photoUrl = uploadedImage.path;
    }

    const [updatedUser] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, authUser.userId))
      .returning();

    // Buscar photoUrl se não foi atualizado
    if (!photoUrl && updatedUser.photoId) {
      const photo = await db.query.images.findFirst({
        where: eq(images.id, updatedUser.photoId),
      });
      photoUrl = photo?.path || null;
    }

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      photoUrl,
    });
  } catch (error: any) {
    console.error("Update user error:", error);
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
