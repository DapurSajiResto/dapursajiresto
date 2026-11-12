// API Upload gambar (logo resto, gambar menu)
// Menerima base64 image, simpan ke public/uploads, return URL
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();

    const body = await req.json();
    const { image, type } = body as { image: string; type: "logo" | "menu" };

    if (!image || !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Format gambar tidak valid" }, { status: 400 });
    }

    // Parse base64
    const matches = image.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: "Format base64 tidak valid" }, { status: 400 });
    }

    const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
    const buffer = Buffer.from(matches[2], "base64");

    // Cek ukuran (max 2MB)
    if (buffer.length > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Ukuran gambar maksimal 2MB" }, { status: 400 });
    }

    // Pastikan folder uploads ada
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate nama file unik
    const fileName = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);

    await writeFile(filePath, buffer);

    // Return URL relatif
    const imageUrl = `/uploads/${fileName}`;

    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Gagal upload gambar" }, { status: 500 });
  }
}
