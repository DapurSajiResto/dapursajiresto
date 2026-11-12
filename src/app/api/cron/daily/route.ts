// Cron job harian - dipanggil tiap hari jam 00:30 WIB (17:30 UTC)
// Endpoint: GET /api/cron/daily?secret=CRON_SECRET
//
// Tugas:
// 1. Cek subscription yang currentPeriodEnd <= now → charge ulang via Xendit
// 2. Cek subscription PAST_DUE yang nextRetryAt <= now → retry charge
// 3. Cek tenant TRIAL yang trialEndsAt <= now+1day → kirim trial_ending email
// 4. Cek tenant TRIAL yang trialEndsAt <= now → suspend (kalau belum setup payment)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  directCharge,
  SUBSCRIPTION_AMOUNT,
} from "@/lib/xendit";
import {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendSuspendNoticeEmail,
  sendTrialEndingEmail,
} from "@/lib/email";

export async function GET(req: NextRequest) {
  // Auth: pakai secret dari query param ATAU Authorization header
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get("secret");
  const authHeader = req.headers.get("authorization") || "";
  const headerSecret = authHeader.replace(/^Bearer\s+/i, "");
  const secret = querySecret || headerSecret;
  const expected = process.env.CRON_SECRET || "dev-cron-secret";

  if (secret !== expected) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const results = {
    renewed: 0,
    retried: 0,
    suspended: 0,
    trialReminders: 0,
    trialExpired: 0,
    errors: [] as string[],
  };

  try {
    // ============================================================
    // 1. Subscription ACTIVE yang currentPeriodEnd <= now → renew
    // ============================================================
    const dueSubs = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        currentPeriodEnd: { lte: now },
      },
      include: { tenant: true },
    });

    for (const sub of dueSubs) {
      try {
        const referenceId = `REC-${sub.tenant.subdomain.toUpperCase()}-${Date.now()}`;

        // Coba charge via Xendit pakai saved payment method
        let chargeSuccess = false;
        try {
          if (sub.paymentMethodToken) {
            await directCharge({
              paymentMethodId: sub.paymentMethodToken,
              amount: SUBSCRIPTION_AMOUNT,
              description: `DapurSajiResto Monthly - ${sub.tenant.namaResto}`,
              referenceId,
            });
            chargeSuccess = true;
          }
        } catch (e) {
          results.errors.push(
            `Charge failed tenant=${sub.tenantId}: ${(e as Error).message}`
          );
        }

        // Buat payment log pending (akan diupdate oleh webhook)
        await prisma.paymentLog.create({
          data: {
            tenantId: sub.tenantId,
            subscriptionId: sub.id,
            amount: SUBSCRIPTION_AMOUNT,
            status: chargeSuccess ? "PENDING" : "FAILED",
            gatewayRef: referenceId,
            ewalletType: sub.ewalletType || undefined,
          },
        });

        if (!chargeSuccess) {
          // Kalau charge gagal, set ke PAST_DUE untuk retry
          const nextRetry = new Date();
          nextRetry.setDate(nextRetry.getDate() + 1);
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: "PAST_DUE",
              retryCount: 1,
              nextRetryAt: nextRetry,
            },
          });
          await prisma.tenant.update({
            where: { id: sub.tenantId },
            data: { status: "PAST_DUE" },
          });
        }

        results.renewed++;
      } catch (err) {
        results.errors.push(
          `Renew tenant=${sub.tenantId}: ${(err as Error).message}`
        );
      }
    }

    // ============================================================
    // 2. Subscription PAST_DUE yang nextRetryAt <= now → retry
    // ============================================================
    const retrySubs = await prisma.subscription.findMany({
      where: {
        status: "PAST_DUE",
        nextRetryAt: { lte: now },
      },
      include: { tenant: true },
    });

    for (const sub of retrySubs) {
      try {
        const referenceId = `RETRY-${sub.tenant.subdomain.toUpperCase()}-${Date.now()}`;

        if (sub.paymentMethodToken) {
          await directCharge({
            paymentMethodId: sub.paymentMethodToken,
            amount: SUBSCRIPTION_AMOUNT,
            description: `DapurSajiResto Retry - ${sub.tenant.namaResto}`,
            referenceId,
          });
        }

        await prisma.paymentLog.create({
          data: {
            tenantId: sub.tenantId,
            subscriptionId: sub.id,
            amount: SUBSCRIPTION_AMOUNT,
            status: "RETRYING",
            gatewayRef: referenceId,
            ewalletType: sub.ewalletType || undefined,
          },
        });

        results.retried++;
      } catch (err) {
        // Jika retry gagal lagi, increment retryCount
        const newRetry = sub.retryCount + 1;
        if (newRetry >= 3) {
          // Suspend
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: "SUSPENDED", retryCount: newRetry, nextRetryAt: null },
          });
          await prisma.tenant.update({
            where: { id: sub.tenantId },
            data: { status: "SUSPENDED", suspendedAt: new Date() },
          });
          await sendSuspendNoticeEmail({
            tenantId: sub.tenantId,
            toEmail: sub.tenant.email,
            namaResto: sub.tenant.namaResto,
            amount: SUBSCRIPTION_AMOUNT,
            lastAttemptDate: now,
          });
          results.suspended++;
        } else {
          const nextRetry = new Date();
          nextRetry.setDate(nextRetry.getDate() + 2);
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { retryCount: newRetry, nextRetryAt: nextRetry },
          });
        }
        results.errors.push(
          `Retry tenant=${sub.tenantId}: ${(err as Error).message}`
        );
      }
    }

    // ============================================================
    // 3. Tenant TRIAL yang trialEndsAt <= now+1day → kirim reminder email
    // ============================================================
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const trialsEndingSoon = await prisma.tenant.findMany({
      where: {
        status: "TRIAL",
        trialEndsAt: {
          gte: now,
          lte: tomorrow,
        },
      },
      include: { subscription: true },
    });

    for (const tenant of trialsEndingSoon) {
      if (
        !tenant.subscription?.paymentMethodToken &&
        tenant.subscription?.status === "TRIALING"
      ) {
        await sendTrialEndingEmail({
          tenantId: tenant.id,
          toEmail: tenant.email,
          namaResto: tenant.namaResto,
          trialEndsAt: tenant.trialEndsAt!,
        });
        results.trialReminders++;
      }
    }

    // ============================================================
    // 4. Tenant TRIAL yang trialEndsAt <= now → suspend (trial expired)
    // ============================================================
    const trialsExpired = await prisma.tenant.findMany({
      where: {
        status: "TRIAL",
        trialEndsAt: { lte: now },
      },
      include: { subscription: true },
    });

    for (const tenant of trialsExpired) {
      if (!tenant.subscription?.paymentMethodToken) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { status: "SUSPENDED", suspendedAt: new Date() },
        });
        await prisma.subscription.update({
          where: { id: tenant.subscription!.id },
          data: { status: "SUSPENDED" },
        });
        await sendSuspendNoticeEmail({
          tenantId: tenant.id,
          toEmail: tenant.email,
          namaResto: tenant.namaResto,
          amount: SUBSCRIPTION_AMOUNT,
          lastAttemptDate: now,
        });
        results.trialExpired++;
      } else {
        // Sudah setup payment → activate
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { status: "ACTIVE" },
        });
        await prisma.subscription.update({
          where: { id: tenant.subscription!.id },
          data: { status: "ACTIVE" },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      runAt: now.toISOString(),
      results,
    });
  } catch (err) {
    console.error("[CRON] Fatal error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: (err as Error).message,
        results,
      },
      { status: 500 }
    );
  }
}
