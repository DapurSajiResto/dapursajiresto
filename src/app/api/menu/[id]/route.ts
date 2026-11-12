// API: Update/delete menu item atau category
// PATCH  /api/menu/[id]   → update (body: { type: "item"|"category", ...fields })
// DELETE /api/menu/[id]   → delete

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireAuth();
    if (!["OWNER", "KASIR"].includes(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json();
    const { id } = params;

    if (body.type === "category") {
      const cat = await prisma.menuCategory.updateMany({
        where: { id, tenantId: user.tenantId },
        data: {
          ...(body.nama !== undefined ? { nama: body.nama } : {}),
          ...(body.urutan !== undefined ? { urutan: body.urutan } : {}),
        },
      });
      if (cat.count === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.type === "item") {
      const item = await prisma.menuItem.updateMany({
        where: { id, tenantId: user.tenantId },
        data: {
          ...(body.nama !== undefined ? { nama: body.nama } : {}),
          ...(body.deskripsi !== undefined ? { deskripsi: body.deskripsi } : {}),
          ...(body.harga !== undefined ? { harga: body.harga } : {}),
          ...(body.gambarUrl !== undefined ? { gambarUrl: body.gambarUrl } : {}),
          ...(body.isAvailable !== undefined ? { isAvailable: body.isAvailable } : {}),
          ...(body.stock !== undefined ? { stock: body.stock } : {}),
          ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        },
      });
      if (item.count === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "type required" }, { status: 400 });
  } catch (err) {
    const e = err as unknown as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || "INTERNAL_ERROR" },
      { status: e.status || 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireAuth();
    if (!["OWNER", "KASIR"].includes(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = params;
    const { searchParams } = new URL(_req.url);
    const type = searchParams.get("type") || "item";

    if (type === "category") {
      // Hapus category + semua items di dalamnya (cascade)
      await prisma.menuCategory.deleteMany({
        where: { id, tenantId: user.tenantId },
      });
    } else {
      await prisma.menuItem.deleteMany({
        where: { id, tenantId: user.tenantId },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as unknown as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || "INTERNAL_ERROR" },
      { status: e.status || 500 }
    );
  }
}
