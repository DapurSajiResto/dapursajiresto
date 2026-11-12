// API: Public menu untuk customer (tanpa login)
// GET /api/public/menu?subdomain=restoa
// Return semua kategori + item yang available

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subdomain = searchParams.get("subdomain");

  if (!subdomain) {
    return NextResponse.json({ error: "subdomain required" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { subdomain: subdomain.toLowerCase() },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Resto tidak ditemukan" }, { status: 404 });
  }

  // Hanya tenant aktif yang menu-nya bisa diakses customer
  if (tenant.status === "SUSPENDED" || tenant.status === "CANCELLED") {
    return NextResponse.json(
      { error: "Resto sedang tidak tersedia" },
      { status: 403 }
    );
  }

  const categories = await prisma.menuCategory.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ urutan: "asc" }, { createdAt: "asc" }],
    include: {
      items: {
        where: { isAvailable: true },
        orderBy: { nama: "asc" },
      },
    },
  });

  return NextResponse.json({
    tenant: {
      namaResto: tenant.namaResto,
      alamat: tenant.alamat,
      phone: tenant.phone,
      logoUrl: tenant.logoUrl,
    },
    categories,
  });
}
