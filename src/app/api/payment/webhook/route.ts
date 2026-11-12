// Webhook Xendit - handle notifikasi pembayaran
// POST /api/payment/webhook
//
// Xendit kirim notif saat:
// - payment pertama berhasil (subscription setup)
// - recurring charge berhasil
// - charge gagal
//
// Verification: cek x-callback-token header == XENDIT_WEBHOOK_TOKEN

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyWebhookToken } from "@/lib/xendit";
import { sendPaymentSuccessEmail, sendPaymentFailedEmail, sendSuspendNoticeEmail } from "@/lib/email";

interface XenditWebhookEvent {
  event: string; // payment.succeeded, payment.failed, invoice.paid, etc.
  data: {
    id: string;
    external_id?: string;
    payment_method_id?: string;
    amount: number;
    currency?: string;
    status: string; // SUCCEEDED, PENDING, FAILED
    payment_method?: {
      type?: string;
      ewallet?: { channel_code?: string };
    };
    created: string;
    updated: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify webhook token dari header
    const callbackToken = req.headers.get("x-callback-token") || "";
    if (!verifyWebhookToken(callbackToken)) {
      console.error("[WEBHOOK] Invalid callback token");
      return NextResponse.json({ error: "Invalid callback token" }, { status: 401 });
    }

    const body = (await req.json()) as XenditWebhookEvent;
    console.log(`[WEBHOOK] Event: ${body.event}, ref: ${body.data.external_id || body.data.id}`);

    // 2. Cari payment log berdasarkan gateway_ref (external_id atau payment_request id)
    const ref = body.data.external_id || body.data.id;
    const paymentLog = await prisma.paymentLog.findFirst({
      where: { gatewayRef: ref },
      include: { subscription: { include: { tenant: true } } },
    });

    if (!paymentLog) {
      console.error("[WEBHOOK] Payment log not found:", ref);
      // Tetap return 200 supaya Xendit tidak retry
      return NextResponse.json({ ok: true, note: "Payment log not found" });
    }

    const sub = paymentLog.subscription;
    const tenant = sub.tenant;
    const isSuccess = body.data.status === "SUCCEEDED" || body.event === "payment.succeeded" || body.event === "invoice.paid";
    const isFailed = body.data.status === "FAILED" || body.event === "payment.failed";

    if (isSuccess) {
      // Update payment log
      await prisma.paymentLog.update({
        where: { id: paymentLog.id },
        data: {
          status: "SUCCESS",
          gatewayRef: body.data.id || paymentLog.gatewayRef,
        },
      });

      // Update subscription: extend periode 1 bulan
      let baseDate = new Date();
      if (sub.currentPeriodEnd && sub.currentPeriodEnd > baseDate) {
        baseDate = new Date(sub.currentPeriodEnd);
      }
      const extendedEnd = new Date(baseDate);
      extendedEnd.setMonth(extendedEnd.getMonth() + 1);

      // Simpan payment method ID untuk recurring
      const pmId = body.data.payment_method_id;

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: extendedEnd,
          retryCount: 0,
          nextRetryAt: null,
          ...(pmId ? { paymentMethodToken: pmId } : {}),
        },
      });

      // Update tenant status
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: "ACTIVE", suspendedAt: null },
      });

      // Kirim email sukses
      const ewalletChannel = body.data.payment_method?.ewallet?.channel_code || paymentLog.ewalletType?.toString() || "EWALLET";
      await sendPaymentSuccessEmail({
        tenantId: tenant.id,
        toEmail: tenant.email,
        namaResto: tenant.namaResto,
        amount: paymentLog.amount,
        ewalletType: ewalletChannel,
        periodeAkhir: extendedEnd,
        tanggalBayar: new Date(),
        nomorRef: body.data.id || ref,
      });

      console.log(`[WEBHOOK] Success: ${ref} tenant=${tenant.id}`);
    } else if (isFailed) {
      // Update payment log failed
      await prisma.paymentLog.update({
        where: { id: paymentLog.id },
        data: {
          status: "FAILED",
          failureReason: body.data.status,
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

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { status: "PAST_DUE" },
        });

        const ewalletChannel = body.data.payment_method?.ewallet?.channel_code || paymentLog.ewalletType?.toString() || "EWALLET";
        await sendPaymentFailedEmail({
          tenantId: tenant.id,
          toEmail: tenant.email,
          namaResto: tenant.namaResto,
          amount: paymentLog.amount,
          ewalletType: ewalletChannel,
          retryCount: newRetryCount,
          nextRetryAt: nextRetry,
          failureReason: body.data.status,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[WEBHOOK] Error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
