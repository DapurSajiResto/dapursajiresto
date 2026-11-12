// Webhook Midtrans - handle notifikasi pembayaran
// POST /api/payment/webhook
//
// Midtrans kirim notif saat:
// - payment pertama berhasil (subscription setup)
// - recurring charge berhasil
// - charge gagal
//
// Signature verification: SHA512(order_id + status_code + gross_amount + server_key)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/midtrans";
import { sendPaymentSuccessEmail, sendPaymentFailedEmail, sendSuspendNoticeEmail } from "@/lib/email";

interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string; // capture, settlement, pending, deny, expire, cancel
  fraud_status?: string;
  payment_type: string;
  transaction_id?: string;
  // Untuk recurring
  subscription_id?: string;
  saved_payment_method_id?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MidtransNotification;

    // 1. Verify signature
    if (!verifyWebhookSignature(body)) {
      console.error("[WEBHOOK] Invalid signature:", body.order_id);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Cari payment log berdasarkan gateway_ref (order_id)
    const paymentLog = await prisma.paymentLog.findFirst({
      where: { gatewayRef: body.order_id },
      include: { subscription: { include: { tenant: true } } },
    });

    if (!paymentLog) {
      console.error("[WEBHOOK] Payment log not found:", body.order_id);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const sub = paymentLog.subscription;
    const tenant = sub.tenant;
    const isSubscriptionSetup = body.order_id.startsWith("SUB-");
    const isRecurringCharge = body.order_id.startsWith("REC-") || !!body.subscription_id;

    // 3. Handle berdasarkan transaction_status
    const isSuccess =
      body.transaction_status === "settlement" ||
      (body.transaction_status === "capture" && body.fraud_status === "accept");

    const isFailed =
      body.transaction_status === "deny" ||
      body.transaction_status === "cancel" ||
      body.transaction_status === "expire";

    if (isSuccess) {
      // Update payment log
      await prisma.paymentLog.update({
        where: { id: paymentLog.id },
        data: {
          status: "SUCCESS",
          gatewayRef: body.transaction_id || paymentLog.gatewayRef,
        },
      });

      // Update subscription: extend periode 1 bulan
      const newPeriodEnd = new Date();
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

      // Jika subscription punya currentPeriodEnd lebih besar dari now, extend dari sana
      let baseDate = new Date();
      if (sub.currentPeriodEnd && sub.currentPeriodEnd > baseDate) {
        baseDate = new Date(sub.currentPeriodEnd);
      }
      const extendedEnd = new Date(baseDate);
      extendedEnd.setMonth(extendedEnd.getMonth() + 1);

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: extendedEnd,
          retryCount: 0,
          nextRetryAt: null,
          // Simpan subscription_id dari Midtrans untuk recurring
          ...(body.subscription_id
            ? { midtransSubscriptionId: body.subscription_id }
            : {}),
          ...(body.saved_payment_method_id
            ? { paymentMethodToken: body.saved_payment_method_id }
            : {}),
        },
      });

      // Update tenant status
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: "ACTIVE", suspendedAt: null },
      });

      // Kirim email sukses
      await sendPaymentSuccessEmail({
        tenantId: tenant.id,
        toEmail: tenant.email,
        namaResto: tenant.namaResto,
        amount: paymentLog.amount,
        ewalletType: paymentLog.ewalletType?.toString() || body.payment_type,
        periodeAkhir: extendedEnd,
        tanggalBayar: new Date(),
        nomorRef: body.transaction_id || body.order_id,
      });

      console.log(`[WEBHOOK] Success: ${body.order_id} tenant=${tenant.id}`);
    } else if (isFailed) {
      // Update payment log failed
      await prisma.paymentLog.update({
        where: { id: paymentLog.id },
        data: {
          status: "FAILED",
          failureReason: `${body.transaction_status}${body.fraud_status ? ` (${body.fraud_status})` : ""}`,
        },
      });

      // Update subscription retry
      const newRetryCount = sub.retryCount + 1;
      const MAX_RETRY = 3;

      if (newRetryCount >= MAX_RETRY) {
        // Suspend
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: "SUSPENDED",
            retryCount: newRetryCount,
            nextRetryAt: null,
          },
        });
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { status: "SUSPENDED", suspendedAt: new Date() },
        });

        await sendSuspendNoticeEmail({
          tenantId: tenant.id,
          toEmail: tenant.email,
          namaResto: tenant.namaResto,
          amount: paymentLog.amount,
          lastAttemptDate: new Date(),
        });
      } else {
        // Schedule retry D+1
        const nextRetry = new Date();
        nextRetry.setDate(nextRetry.getDate() + 1);

        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: "PAST_DUE",
            retryCount: newRetryCount,
            nextRetryAt: nextRetry,
          },
        });

        // Update tenant status ke PAST_DUE (masih bisa akses)
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { status: "PAST_DUE" },
        });

        await sendPaymentFailedEmail({
          tenantId: tenant.id,
          toEmail: tenant.email,
          namaResto: tenant.namaResto,
          amount: paymentLog.amount,
          ewalletType: paymentLog.ewalletType?.toString() || body.payment_type,
          retryCount: newRetryCount,
          nextRetryAt: nextRetry,
          failureReason: body.transaction_status,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[WEBHOOK] Error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
