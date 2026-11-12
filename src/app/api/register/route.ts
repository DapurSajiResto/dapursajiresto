// API: Register resto baru (self-service onboarding)
// POST /api/register
// Body: { namaResto, subdomain, ownerName, email, phone, password }
//
// Flow:
// 1. Validasi input
// 2. Cek subdomain & email unik
// 3. Create tenant (status TRIAL, trialEndsAt = now + 7 days)
// 4. Create user owner
// 5. Create subscription record (status TRIALING)
// 6. Kirim welcome email

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { normalizeSubdomain } from "@/lib/tenant";
import { sendWelcomeEmail } from "@/lib/email";
import { z } from "zod";

const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 7);
const SUBSCRIPTION_PRICE = Number(process.env.SUBSCRIPTION_PRICE || 10000);

const schema = z.object({
  namaResto: z.string().min(2).max(100),
  subdomain: z.string().min(3).max(30),
  ownerName: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse({
      ...body,
      subdomain: normalizeSubdomain(body.subdomain || ""),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { namaResto, subdomain, ownerName, email, phone, password } =
      parsed.data;

    // Cek unik
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ subdomain }, { email: email.toLowerCase() }],
      },
    });
    if (existingTenant) {
      return NextResponse.json(
        {
          error:
            existingTenant.subdomain === subdomain
              ? "Subdomain sudah dipakai"
              : "Email sudah terdaftar",
        },
        { status: 409 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Trial end date
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    // Create tenant + user + subscription (transaction)
    const tenant = await prisma.tenant.create({
      data: {
        namaResto,
        subdomain,
        ownerName,
        email: email.toLowerCase(),
        phone,
        status: "TRIAL",
        trialEndsAt,
      },
    });

    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: email.toLowerCase(),
        passwordHash,
        name: ownerName,
        role: "OWNER",
      },
    });

    const subscription = await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: "basic",
        harga: SUBSCRIPTION_PRICE,
        status: "TRIALING",
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndsAt,
      },
    });

    // Kirim welcome email (non-blocking)
    sendWelcomeEmail({
      tenantId: tenant.id,
      toEmail: tenant.email,
      namaResto: tenant.namaResto,
      subdomain: tenant.subdomain,
      trialEndsAt,
    }).catch((err) => {
      console.error("[REGISTER] Welcome email failed:", err);
    });

    return NextResponse.json(
      {
        ok: true,
        tenantId: tenant.id,
        subdomain: tenant.subdomain,
        trialEndsAt: trialEndsAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[REGISTER] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
