// API: Menu CRUD (owner only)
// GET    /api/menu          → list menu (categories + items) per tenant
// POST   /api/menu          → create category or item
// PATCH  /api/menu/[id]     → update
// DELETE /api/menu/[id]     → delete

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { z } from "zod";

const createCategorySchema = z.object({
  type: z.literal("category"),
  nama: z.string().min(1).max(100),
  urutan: z.number().int().default(0),
});

const createItemSchema = z.object({
  type: z.literal("item"),
  categoryId: z.string().min(1),
  nama: z.string().min(1).max(200),
  deskripsi: z.string().max(500).optional(),
  harga: z.number().int().min(0),
  gambarUrl: z.string().optional().or(z.literal("")),
  isAvailable: z.boolean().default(true),
  stock: z.number().int().min(0).default(0),
});

export async function GET() {
  try {
    const { user } = await requireAuth();

    const categories = await prisma.menuCategory.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ urutan: "asc" }, { createdAt: "asc" }],
      include: {
        items: {
          orderBy: { nama: "asc" },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (err) {
    const e = err as unknown as { status?: number; message?: string };
    if (e.message === "TENANT_SUSPENDED") {
      return NextResponse.json({ error: "Akun di-suspend" }, { status: 403 });
    }
    return NextResponse.json(
      { error: e.message || "UNAUTHORIZED" },
      { status: e.status || 401 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    // Hanya owner & kasir yang bisa kelola menu
    if (!["OWNER", "KASIR"].includes(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json();

    // Validasi: category atau item
    if (body.type === "category") {
      const parsed = createCategorySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const cat = await prisma.menuCategory.create({
        data: {
          tenantId: user.tenantId,
          nama: parsed.data.nama,
          urutan: parsed.data.urutan,
        },
      });
      return NextResponse.json({ category: cat }, { status: 201 });
    }

    if (body.type === "item") {
      const parsed = createItemSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      // Verify category milik tenant
      const cat = await prisma.menuCategory.findFirst({
        where: { id: parsed.data.categoryId, tenantId: user.tenantId },
      });
      if (!cat) {
        return NextResponse.json(
          { error: "Category tidak ditemukan" },
          { status: 404 }
        );
      }
      const item = await prisma.menuItem.create({
        data: {
          tenantId: user.tenantId,
          categoryId: parsed.data.categoryId,
          nama: parsed.data.nama,
          deskripsi: parsed.data.deskripsi,
          harga: parsed.data.harga,
          gambarUrl: parsed.data.gambarUrl || null,
          isAvailable: parsed.data.isAvailable,
          stock: parsed.data.stock,
        },
      });
      return NextResponse.json({ item }, { status: 201 });
    }

    return NextResponse.json({ error: "type harus 'category' atau 'item'" }, { status: 400 });
  } catch (err) {
    const e = err as unknown as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || "INTERNAL_ERROR" },
      { status: e.status || 500 }
    );
  }
}
