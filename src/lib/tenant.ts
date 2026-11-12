// Tenant resolver - resolve subdomain → tenant
// Dipakai di middleware & server components

import prisma from "./db";

/**
 * Ekstrak subdomain dari hostname.
 * Misal: "restoa.namadomain.com" → "restoa"
 * "restoa.namadomain.com:3000" → "restoa"
 * Di development (localhost), return null.
 */
export function extractSubdomain(hostname: string): string | null {
  const baseDomain = process.env.BASE_DOMAIN || "localhost:3000";
  // Hapus port jika ada
  const host = hostname.split(":")[0];
  const base = baseDomain.split(":")[0];

  // Development: localhost / 127.0.0.1 → tidak ada subdomain
  if (host === "localhost" || host === "127.0.0.1" || host === base) {
    return null;
  }

  // Ambil bagian sebelum baseDomain
  if (host.endsWith(`.${base}`)) {
    const sub = host.slice(0, host.length - base.length - 1);
    // Hanya ambil subdomain pertama (tidak support nested)
    return sub.split(".")[0] || null;
  }

  return null;
}

/**
 * Resolve tenant dari request hostname.
 * Return null jika tidak ditemukan / di localhost.
 */
export async function getTenantByHostname(hostname: string) {
  const subdomain = extractSubdomain(hostname);
  if (!subdomain) return null;

  return prisma.tenant.findUnique({
    where: { subdomain },
  });
}

/**
 * Resolve tenant dari subdomain string langsung.
 */
export async function getTenantBySubdomain(subdomain: string) {
  return prisma.tenant.findUnique({
    where: { subdomain: subdomain.toLowerCase() },
  });
}

/**
 * Cek apakah tenant punya akses aktif (TRIAL / ACTIVE / PAST_DUE).
 * SUSPENDED & CANCELLED → tidak boleh akses dashboard.
 */
export function isTenantAccessible(status: string): boolean {
  return ["TRIAL", "ACTIVE", "PAST_DUE"].includes(status);
}

/**
 * Normalisasi subdomain: lowercase, hapus spasi, hapus karakter non-alnum.
 */
export function normalizeSubdomain(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}
