import { createHash } from "crypto";
import { db } from "@/db";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function calculateMD5(buffer: Buffer): Promise<string> {
  return createHash("md5").update(buffer).digest("hex");
}

export async function uploadImage(file: File): Promise<{ id: string; path: string; checksum: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = await calculateMD5(buffer);
  
  // Verificar se imagem já existe
  const existingImage = await db.query.images.findFirst({
    where: eq(images.checksum, checksum),
  });

  if (existingImage) {
    return {
      id: existingImage.id,
      path: `/api/images/${existingImage.id}`,
      checksum: existingImage.checksum,
    };
  }

  // Converter imagem para base64
  const base64Data = buffer.toString('base64');
  const mimeType = file.type || 'image/png';

  // Salvar no banco
  const [newImage] = await db.insert(images).values({
    checksum,
    path: `/api/images/${checksum}`, // Placeholder, será atualizado
    data: base64Data,
    mimeType,
  }).returning();

  // Atualizar path com o ID correto
  const [updatedImage] = await db.update(images)
    .set({ path: `/api/images/${newImage.id}` })
    .where(eq(images.id, newImage.id))
    .returning();

  return {
    id: updatedImage.id,
    path: updatedImage.path,
    checksum: updatedImage.checksum,
  };
}
