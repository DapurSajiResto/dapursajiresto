// API: Orders CRUD
// GET    /api/orders          → list orders (filter by status, date)
// POST   /api/orders          → create new order (dari POS)
// PATCH  /api/orders/[id]     → update status
//
// Real-time: setiap create/update → emit socket event ke tenant room

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { getIO, SOCKET_EVENTS } from "@/lib/socket";
import { z } from "zod";

// Generate nomor order: ORD-001, ORD-002, ... (per tenant)
async function generateOrderNumber(tenantId: string): Promise<string> {
  const count = await prisma.order.count({ where: { tenantId } });
  const next = count + 1;
  return `ORD-${String(next).padStart(4, "0")}`;
}

const createOrderSchema = z.object({
  tableNumber: z.string().optional(),
  customerName: z.string().optional(),
  orderType: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]).default("DINE_IN"),
  catatan: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        qty: z.number().int().min(1),
        catatan: z.string().optional(),
      })
    )
    .min(1),
});

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

    const orders = await prisma.order.findMany({
      where: {
        tenantId: user.tenantId,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        items: {
          include: { menuItem: { select: { nama: true, harga: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ orders });
  } catch (err) {
    const e = err as unknown as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || "UNAUTHORIZED" },
      { status: e.status || 401 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();

    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { items, orderType, tableNumber, customerName, catatan } =
      parsed.data;

    // Verify menu items milik tenant & ambil snapshot harga
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: items.map((i) => i.menuItemId) },
        tenantId: user.tenantId,
        isAvailable: true,
      },
    });

    if (menuItems.length !== items.length) {
      return NextResponse.json(
        { error: "Ada item menu tidak valid/tidak tersedia" },
        { status: 400 }
      );
    }

    // Hitung total + siapkan order items
    let total = 0;
    const orderItemsData = items.map((item) => {
      const menu = menuItems.find((m) => m.id === item.menuItemId)!;
      const subtotal = menu.harga * item.qty;
      total += subtotal;
      return {
        menuItemId: item.menuItemId,
        namaSnapshot: menu.nama,
        hargaSnapshot: menu.harga,
        qty: item.qty,
        subtotal,
        catatan: item.catatan || null,
      };
    });

    const nomorOrder = await generateOrderNumber(user.tenantId);

    const order = await prisma.order.create({
      data: {
        tenantId: user.tenantId,
        nomorOrder,
        tableNumber: tableNumber || null,
        customerName: customerName || null,
        orderType: orderType as never,
        status: "PENDING",
        total,
        catatan: catatan || null,
        createdById: user.id,
        items: { create: orderItemsData },
      },
      include: { items: true },
    });

    // Emit real-time: order baru ke semua device di tenant tsb
    const io = getIO();
    if (io) {
      io.to(`tenant:${user.tenantId}`).emit(SOCKET_EVENTS.ORDER_NEW, {
        order,
        tenantId: user.tenantId,
      });
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    console.error("[ORDERS] Create error:", err);
    const e = err as unknown as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || "INTERNAL_ERROR" },
      { status: e.status || 500 }
    );
  }
}
