// API: Generate struk data untuk print
// GET /api/print/[orderId]
// Return ReceiptData lengkap untuk dikirim ke ESC/POS builder atau StrukPreview

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { calculateCharges, StrukSettings } from "@/lib/charges";

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { user, tenant } = await requireAuth();

    const order = await prisma.order.findFirst({
      where: { id: params.orderId, tenantId: user.tenantId },
      include: {
        items: true,
        transaction: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    const transaction = order.transaction;

    const tanggal = new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(new Date(order.createdAt));

    const orderTypeLabel =
      order.orderType === "DINE_IN"
        ? "Dine-in"
        : order.orderType === "TAKEAWAY"
        ? "Bawa Pulang"
        : "Antar";

    // Hitung subtotal dari items (order.total mungkin sudah include pajak)
    const subtotal = order.items.reduce((sum, i) => sum + i.subtotal, 0);

    // Baca strukSettings dari tenant & hitung charges
    const strukSettings =
      tenant?.strukSettings && typeof tenant.strukSettings === "object"
        ? (tenant.strukSettings as unknown as StrukSettings)
        : null;
    const charges = calculateCharges(subtotal, strukSettings);

    // Jika order.total === subtotal (tidak ada pajak), pakai charges.total
    // Jika order.total sudah berbeda (sudah include pajak saat dibuat), pakai order.total
    const finalTotal = order.total > subtotal ? order.total : charges.total;

    return NextResponse.json({
      receipt: {
        namaResto: tenant?.namaResto || "Restoran",
        alamat: tenant?.alamat || undefined,
        phone: tenant?.phone || undefined,
        logoUrl: tenant?.logoUrl || undefined,
        header: tenant?.strukHeader || undefined,
        footer: tenant?.strukFooter || "Terima kasih telah berkunjung",
        width: tenant?.strukWidth || 58,
        nomorStruk: transaction?.nomorStruk || `DRAFT-${order.nomorOrder}`,
        nomorOrder: order.nomorOrder,
        tanggal,
        tableNumber: order.tableNumber || undefined,
        customerName: order.customerName || undefined,
        orderType: orderTypeLabel,
        items: order.items.map((i) => ({
          nama: i.namaSnapshot,
          qty: i.qty,
          harga: i.hargaSnapshot,
          subtotal: i.subtotal,
        })),
        subtotal,
        pajak: charges.pajak || undefined,
        serviceCharge: charges.serviceCharge || undefined,
        chargesTambahan: charges.chargesTambahan.length > 0 ? charges.chargesTambahan : undefined,
        total: finalTotal,
        paymentMethod: transaction
          ? transaction.paymentMethod
          : undefined,
        bayar: transaction?.bayar,
        kembalian: transaction?.kembalian,
      },
    });
  } catch (err) {
    const e = err as unknown as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || "INTERNAL_ERROR" },
      { status: e.status || 500 }
    );
  }
}
