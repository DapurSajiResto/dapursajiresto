// API Pengaturan Resto - logo, struk config, pajak, service charge
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/db";

// GET - ambil pengaturan saat ini
export async function GET() {
  try {
    const { tenant } = await requireAuth();

    if (!tenant) {
      return NextResponse.json({ error: "Resto tidak ditemukan" }, { status: 404 });
    }

    // Default struk settings
    const defaultSettings = {
      pajakAktif: true,
      pajakPersen: 10,
      pajakNama: "Pajak",
      serviceChargeAktif: false,
      serviceChargePersen: 5,
      serviceChargeNama: "Service Charge",
      chargesTambahan: [] as { nama: string; persen: number }[],
    };

    const rawSettings =
      tenant.strukSettings && typeof tenant.strukSettings === "object"
        ? (tenant.strukSettings as Record<string, unknown>)
        : {};

    const settings = { ...defaultSettings, ...rawSettings };

    return NextResponse.json({
      namaResto: tenant.namaResto,
      alamat: tenant.alamat,
      phone: tenant.phone,
      logoUrl: tenant.logoUrl,
      strukHeader: tenant.strukHeader,
      strukFooter: tenant.strukFooter,
      strukWidth: tenant.strukWidth,
      strukSettings: settings,
    });
  } catch (error) {
    console.error("GET pengaturan error:", error);
    const e = error as unknown as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || "Gagal ambil pengaturan" },
      { status: e.status || 500 }
    );
  }
}

// PUT - update pengaturan
export async function PUT(req: NextRequest) {
  try {
    const { user } = await requireAuth();

    const body = await req.json();
    const {
      namaResto,
      alamat,
      phone,
      logoUrl,
      strukHeader,
      strukFooter,
      strukWidth,
      strukSettings,
    } = body;

    // Validasi strukSettings
    const settings = {
      pajakAktif: Boolean(strukSettings?.pajakAktif),
      pajakPersen: Number(strukSettings?.pajakPersen) || 0,
      pajakNama: String(strukSettings?.pajakNama || "Pajak"),
      serviceChargeAktif: Boolean(strukSettings?.serviceChargeAktif),
      serviceChargePersen: Number(strukSettings?.serviceChargePersen) || 0,
      serviceChargeNama: String(strukSettings?.serviceChargeNama || "Service Charge"),
      chargesTambahan: Array.isArray(strukSettings?.chargesTambahan)
        ? strukSettings.chargesTambahan.map((c: { nama: string; persen: number }) => ({
            nama: String(c.nama),
            persen: Number(c.persen) || 0,
          }))
        : [],
    };

    const updated = await prisma.tenant.update({
      where: { id: user.tenantId },
      data: {
        ...(namaResto && { namaResto }),
        ...(alamat !== undefined && { alamat }),
        ...(phone !== undefined && { phone }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(strukHeader !== undefined && { strukHeader }),
        ...(strukFooter !== undefined && { strukFooter }),
        ...(strukWidth && { strukWidth: Number(strukWidth) }),
        strukSettings: settings,
      },
      select: {
        id: true,
        namaResto: true,
        logoUrl: true,
        strukSettings: true,
      },
    });

    return NextResponse.json({ ok: true, tenant: updated });
  } catch (error) {
    console.error("PUT pengaturan error:", error);
    const e = error as unknown as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || "Gagal update pengaturan" },
      { status: e.status || 500 }
    );
  }
}
