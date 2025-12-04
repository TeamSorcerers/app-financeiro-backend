import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, categories } from "@/db/schema";
import { signUpSchema, parseFormData } from "@/lib/validations";
import { hashPassword, generateToken } from "@/lib/auth";
import { uploadImage } from "@/lib/upload";
import { DEFAULT_USER_CATEGORIES } from "@/lib/defaultCategories";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Validar com Zod
    const validatedData = parseFormData(signUpSchema, formData);

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, validatedData.email),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "E-mail já cadastrado" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Upload photo if provided
    let photoId: string | null = null;
    let photoUrl: string | null = null;
    
    if (validatedData.photo) {
      const uploadedImage = await uploadImage(validatedData.photo);
      photoId = uploadedImage.id;
      photoUrl = uploadedImage.path;
    }

    // Create user
    const [newUser] = await db.insert(users).values({
      name: validatedData.name,
      email: validatedData.email,
      password: hashedPassword,
      photoId,
    }).returning();

    // Criar categorias padrão para o usuário
    await db.insert(categories).values(
      DEFAULT_USER_CATEGORIES.map(cat => ({
        userId: newUser.id,
        name: cat.name,
        emoji: cat.emoji,
        type: cat.type,
      }))
    );

    // Generate token
    const token = generateToken({
      userId: newUser.id,
      email: newUser.email,
    });

    return NextResponse.json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        photoUrl,
      },
      token,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Signup error:", error);
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
