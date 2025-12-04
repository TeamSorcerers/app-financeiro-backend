import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const image = await db.query.images.findFirst({
      where: eq(images.id, id),
    });

    if (!image) {
      return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 });
    }

    // Converter base64 para buffer
    const buffer = Buffer.from(image.data, 'base64');

    // Retornar imagem com headers corretos
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': image.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error("Get image error:", error);
    return NextResponse.json({ error: "Erro ao carregar imagem" }, { status: 500 });
  }
}
