import { createHash } from "crypto";
import { writeFile, mkdir, access } from "fs/promises";
import { join } from "path";
import { db } from "@/db";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";

const UPLOAD_DIR = join(process.cwd(), "public", "images");

export async function calculateMD5(buffer: Buffer): Promise<string> {
  return createHash("md5").update(buffer).digest("hex");
}

export async function ensureUploadDir() {
  try {
    await access(UPLOAD_DIR);
  } catch {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export async function uploadImage(file: File): Promise<{ id: string; path: string; checksum: string }> {
  await ensureUploadDir();

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = await calculateMD5(buffer);
  
  // Verificar se imagem já existe
  const existingImage = await db.query.images.findFirst({
    where: eq(images.checksum, checksum),
  });

  if (existingImage) {
    return {
      id: existingImage.id,
      path: existingImage.path,
      checksum: existingImage.checksum,
    };
  }

  // Salvar nova imagem
  const filename = `${checksum}.png`;
  const filepath = join(UPLOAD_DIR, filename);
  const publicPath = `/images/${filename}`;

  await writeFile(filepath, buffer);

  // Registrar no banco
  const [newImage] = await db.insert(images).values({
    checksum,
    path: publicPath,
  }).returning();

  return {
    id: newImage.id,
    path: newImage.path,
    checksum: newImage.checksum,
  };
}
