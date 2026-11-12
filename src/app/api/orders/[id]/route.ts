// API: Update order status
// PATCH /api/orders/[id]  body: { status, paymentMethod?, bayar? }
// Jika status → PAID: auto-create transaction record (struk)

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { getIO, SOCKET_EVENTS } from "@/lib/socket";

const VALID_STATUSES = ["PENDING", "COOKING", "READY", "SERVED", "PAID", "CANCELLED"];

// Generate nomor struk
async function generateStrukNumber(tenantId: string): Promise<string> {
  const count = await prisma.transaction.count({ where: { tenantId } });
  return `STRUK-${String(count + 1).padStart(5, "0")}`;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireAuth();
    const body = await req.json();
    const { id } = params;

    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "status tidak valid" }, { status: 400 });
    }

    // Verify order milik tenant
    const existing = await prisma.order.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    const newStatus = body.status as string;

    // Update order status
    const updated = await prisma.order.update({
      where: { id },
      data: { status: newStatus as never },
      include: { items: true },
    });

    // Jika PAID: buat transaction record (struk)
    if (newStatus === "PAID" && existing.status !== "PAID") {
      const paymentMethod = body.paymentMethod || "CASH";
      const bayar = Number(body.bayar) || 0;
      const kembalian = bayar > updated.total ? bayar - updated.total : 0;

      const nomorStruk = await generateStrukNumber(user.tenantId);

      await prisma.transaction.create({
        data: {
          tenantId: user.tenantId,
          orderId: updated.id,
          nomorStruk,
          total: updated.total,
          paymentMethod: paymentMethod as never,
          bayar,
          kembalian,
        },
      });

      // Emit order:paid untuk trigger print struk
      const io = getIO();
      if (io) {
        io.to(`tenant:${user.tenantId}`).emit(SOCKET_EVENTS.ORDER_PAID, {
          orderId: updated.id,
          nomorStruk,
          tenantId: user.tenantId,
        });
      }
    }

    // Emit status update
    const io = getIO();
    if (io) {
      io.to(`tenant:${user.tenantId}`).emit(SOCKET_EVENTS.ORDER_STATUS_UPDATE, {
        orderId: updated.id,
        status: newStatus,
        tenantId: user.tenantId,
      });
    }

    return NextResponse.json({ order: updated });
  } catch (err) {
    const e = err as unknown as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || "INTERNAL_ERROR" },
      { status: e.status || 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireAuth();
    const order = await prisma.order.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      include: {
        items: {
          include: { menuItem: { select: { nama: true, harga: true } } },
        },
        transaction: true,
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (err) {
    const e = err as unknown as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || "UNAUTHORIZED" },
      { status: e.status || 401 }
    );
  }
}
