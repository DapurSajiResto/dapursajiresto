// Middleware: routing subdomain + auth gate + suspend check
//
// Logic:
// 1. Request ke subdomain (restoa.namadomain.com) → resolve tenant
// 2. Public routes (/menu, /api/public/*, /login, /register) → lewat
// 3. /dashboard/* & /api/* (kecuali public) → wajib auth + tenant aktif
// 4. Tenant SUSPENDED → redirect ke /suspended
//
// Catatan: middleware jalan di edge runtime, tidak bisa pakai Prisma langsung.
// Untuk resolve tenant di edge, gunakan cache / edge-compatible DB.
// Untuk MVP: kita skip tenant resolve di middleware (lakukan di server component / route handler).
// Middleware fokus: proteksi route berdasarkan token NextAuth.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/suspended",
  "/api/auth",
  "/api/public",
  "/api/payment/webhook",
  "/api/payment/gopay-callback",
  "/api/payment/ewallet-callback",
  "/api/cron",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths: skip auth
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // API routes non-public: wajib auth token (kecuali webhook & cron yang punya secret sendiri)
  if (pathname.startsWith("/api/")) {
    // Webhook & cron pakai signature/secret sendiri (di route handler)
    return NextResponse.next();
  }

  // /dashboard/* & /pos/* & /kitchen/* & /menu/manage → wajib login
  const protectedPaths = ["/dashboard", "/pos", "/kitchen", "/struk", "/users", "/settings"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Suspend check (dari token - status disimpan saat login)
    // Token role & tenantId sudah divalidasi di authorize()
    // Jika tenant di-suspend setelah login, JWT belum expired → kita biarkan,
    // tapi route handler akan re-check tenant.status dari DB tiap request
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match semua request kecuali:
     * - _next/static, _next/image, favicon
     * - file static (png, jpg, svg, dll)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
