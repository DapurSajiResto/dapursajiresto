// API: Setup subscription - user pilih e-wallet, buat payment via Xendit
// POST /api/payment/subscribe
// Body: { ewalletType: "OVO"|"GOPAY"|"SHOPEEPAY"|"DANA"|"LINKAJA"|"QRIS"|"BCA" }
//
// Flow:
// 1. Create Xendit customer + payment method (e-wallet)
// 2. Buat payment session / invoice untuk user authorize
// 3. Return redirect URL untuk user bayar/authorize
// 4. Setelah bayar (webhook), Xendit kirim notif → handler setup recurring

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  createCustomer,
  createPaymentMethod,
  createPaymentSession,
  createInvoice,
  createRecurringPayment,
  SUBSCRIPTION_AMOUNT,
  SUPPORTED_EWALLETS,
} from "@/lib/xendit";
import { z } from "zod";

const schema = z.object({
  ewalletType: z.enum(["OVO", "GOPAY", "SHOPEEPAY", "DANA", "LINKAJA", "QRIS", "BCA"]),
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
    if (existing?.status === "ACTIVE" && existing.paymentMethodToken) {
      return NextResponse.json(
        { error: "Langganan sudah aktif", subscription: existing },
        { status: 400 }
      );
    }

    const externalId = `SUB-${tenant!.subdomain.toUpperCase()}-${Date.now()}`;

    // Untuk BCA manual transfer: buat invoice saja
    if (ewalletType === "BCA") {
      const invoice = await createInvoice({
        externalId,
        amount: SUBSCRIPTION_AMOUNT,
        description: "DapurSajiResto Subscription - Monthly (BCA Transfer)",
        customerName: tenant!.namaResto,
        customerEmail: tenant!.email,
        customerPhone: tenant!.phone || undefined,
        paymentMethods: ["BCA"],
      });

      await prisma.paymentLog.create({
        data: {
          tenantId: user.tenantId,
          subscriptionId: existing!.id,
          amount: SUBSCRIPTION_AMOUNT,
          status: "PENDING",
          gatewayRef: externalId,
          ewalletType: "BCA" as never,
        },
      });

      await prisma.subscription.update({
        where: { tenantId: user.tenantId },
        data: { ewalletType: "BCA" as never },
      });

      return NextResponse.json({
        externalId,
        paymentUrl: invoice.invoice_url,
        method: "invoice",
      });
    }

    // Untuk QRIS: buat invoice dengan QRIS
    if (ewalletType === "QRIS") {
      const invoice = await createInvoice({
        externalId,
        amount: SUBSCRIPTION_AMOUNT,
        description: "DapurSajiResto Subscription - Monthly (QRIS)",
        customerName: tenant!.namaResto,
        customerEmail: tenant!.email,
        customerPhone: tenant!.phone || undefined,
        paymentMethods: ["QRIS"],
      });

      await prisma.paymentLog.create({
        data: {
          tenantId: user.tenantId,
          subscriptionId: existing!.id,
          amount: SUBSCRIPTION_AMOUNT,
          status: "PENDING",
          gatewayRef: externalId,
          ewalletType: "QRIS" as never,
        },
      });

      await prisma.subscription.update({
        where: { tenantId: user.tenantId },
        data: { ewalletType: "QRIS" as never },
      });

      return NextResponse.json({
        externalId,
        paymentUrl: invoice.invoice_url,
        method: "invoice",
      });
    }

    // Untuk e-wallet (OVO, GOPAY, SHOPEEPAY, DANA, LINKAJA):
    // 1. Create customer di Xendit
    const customer = await createCustomer({
      referenceId: tenant!.id,
      name: tenant!.namaResto,
      email: tenant!.email,
      phone: tenant!.phone || undefined,
    });

    // 2. Create payment method (reusable e-wallet)
    const paymentMethod = await createPaymentMethod({
      customerId: customer.id,
      ewalletType: ewalletType as "OVO" | "GOPAY" | "SHOPEEPAY" | "DANA" | "LINKAJA",
      customerName: tenant!.namaResto,
      customerEmail: tenant!.email,
      customerPhone: tenant!.phone || undefined,
      successReturnUrl: `${process.env.NEXTAUTH_URL}/payment/success`,
      failureReturnUrl: `${process.env.NEXTAUTH_URL}/payment/failed`,
    });

    // 3. Buat payment session untuk user authorize
    const session = await createPaymentSession({
      paymentMethodId: paymentMethod.id,
      customerId: customer.id,
      amount: SUBSCRIPTION_AMOUNT,
      returnUrl: `${process.env.NEXTAUTH_URL}/payment/success`,
    });

    // Simpan payment log pending
    await prisma.paymentLog.create({
      data: {
        tenantId: user.tenantId,
        subscriptionId: existing!.id,
        amount: SUBSCRIPTION_AMOUNT,
        status: "PENDING",
        gatewayRef: externalId,
        ewalletType: ewalletType as never,
      },
    });

    // Update subscription dengan ewallet type dan xendit customer id
    await prisma.subscription.update({
      where: { tenantId: user.tenantId },
      data: {
        ewalletType: ewalletType as never,
        midtransSubscriptionId: customer.id, // reuse field untuk Xendit customer ID
      },
    });

    return NextResponse.json({
      externalId,
      paymentMethodId: paymentMethod.id,
      paymentUrl: session.redirect_url,
      method: "payment_session",
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
