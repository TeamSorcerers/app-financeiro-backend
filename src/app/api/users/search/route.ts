import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, images } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Buscar foto do usuário
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
    console.error("Search user error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
