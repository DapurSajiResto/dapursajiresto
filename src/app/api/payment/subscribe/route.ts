// API: Setup subscription - user pilih e-wallet, create charge pertama
// POST /api/payment/subscribe
// Body: { ewalletType: "gopay"|"ovo"|"shopeepay"|"qris"|"bank_transfer" }
//
// Flow:
// 1. Create Midtrans charge order (Rp 10.000) dengan payment type sesuai
// 2. Return payment URL/deeplink untuk user bayar
// 3. Setelah bayar (webhook), Midtrans kirim notif → handler setup recurring
//
// Catatan: Midtrans subscription API untuk GoPay bisa auto-recurring.
// Untuk OVO/ShopeePay via QRIS/Gopay account, recurring perlu approval merchant.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { createCharge, SUBSCRIPTION_AMOUNT, SUPPORTED_EWALLETS } from "@/lib/midtrans";
import { z } from "zod";

const schema = z.object({
  ewalletType: z.enum(["gopay", "ovo", "shopeepay", "qris", "bank_transfer"]),
});

export async function POST(req: NextRequest) {
  try {
    const { user, tenant } = await requireAuth();
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { ewalletType } = parsed.data;

    // Cek apakah sudah punya subscription aktif
    const existing = await prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
    });
    if (existing?.status === "ACTIVE" && existing.midtransSubscriptionId) {
      return NextResponse.json(
        { error: "Langganan sudah aktif", subscription: existing },
        { status: 400 }
      );
    }

    // Buat Midtrans order ID unik
    const orderId = `SUB-${tenant!.subdomain.toUpperCase()}-${Date.now()}`;

    // Create charge pertama (Rp 10.000) - sekaligus save payment method
    const charge = await createCharge({
      orderId,
      grossAmount: SUBSCRIPTION_AMOUNT,
      customerName: tenant!.namaResto,
      customerEmail: tenant!.email,
      customerPhone: tenant!.phone || undefined,
      paymentType: ewalletType as "gopay" | "qris" | "shopeepay" | "ovo" | "bank_transfer",
      savePaymentMethod: true,
    });

    // Simpan payment log pending
    await prisma.paymentLog.create({
      data: {
        tenantId: user.tenantId,
        subscriptionId: existing!.id,
        amount: SUBSCRIPTION_AMOUNT,
        status: "PENDING",
        gatewayRef: orderId,
        ewalletType: ewalletType.toUpperCase() as never,
      },
    });

    // Update subscription ewallet type
    await prisma.subscription.update({
      where: { tenantId: user.tenantId },
      data: {
        ewalletType: ewalletType.toUpperCase() as never,
      },
    });

    return NextResponse.json({
      orderId,
      charge,
      // Untuk GoPay/Qris: charge.actions punya deep-link/QR URL
      paymentUrl:
        (charge as { actions?: { name: string; url?: string }[] })?.actions?.find(
          (a) => a.name === "deeplink-charge" || a.name === "generate-qr-code"
        )?.url || null,
    });
  } catch (err) {
    console.error("[SUBSCRIBE] Error:", err);
    const e = err as unknown as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || "INTERNAL_ERROR" },
      { status: e.status || 500 }
    );
  }
}

// GET - ambil info langganan saat ini + e-wallet options
export async function GET() {
  try {
    const { user, tenant } = await requireAuth();

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
      include: {
        paymentLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    return NextResponse.json({
      tenant,
      subscription,
      ewalletOptions: SUPPORTED_EWALLETS,
      price: SUBSCRIPTION_AMOUNT,
      paymentInfo: {
        bankName: process.env.PAYMENT_BANK_NAME || "BCA",
        accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || "5390986868",
        accountName:
          process.env.PAYMENT_ACCOUNT_NAME || "HSRA HIDUP SEJAHTERA CV",
      },
    });
  } catch (err) {
    const e = err as unknown as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || "UNAUTHORIZED" },
      { status: e.status || 401 }
    );
  }
}
