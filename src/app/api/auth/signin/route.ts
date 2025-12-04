import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, images } from "@/db/schema";
import { signInSchema } from "@/lib/validations";
import { verifyPassword, generateToken } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = signInSchema.parse(body);

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, validatedData.email),
    });

    if (!user) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos" },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(validatedData.password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos" },
        { status: 401 }
      );
    }

    // Buscar photoUrl se existir photoId
    let photoUrl: string | null = null;
    if (user.photoId) {
      const photo = await db.query.images.findFirst({
        where: eq(images.id, user.photoId),
      });
      photoUrl = photo?.path || null;
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        photoUrl,
      },
      token,
    });
  } catch (error: any) {
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
