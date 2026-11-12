// Server-side auth helpers
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import prisma from "./db";
import { isTenantAccessible } from "./tenant";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  subdomain: string;
  namaResto: string;
}

export async function getAuthSession() {
  const session = await getServerSession(authOptions);
  return session;
}

/**
 * Get session + verify tenant masih aktif dari DB.
 * Throw 401 jika tidak ada session, 403 jika tenant suspend.
 */
export async function requireAuth(): Promise<{
  user: SessionUser;
  tenant: Awaited<ReturnType<typeof prisma.tenant.findUnique>>;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    const err = new Error("UNAUTHORIZED");
    (err as unknown as { status: number }).status = 401;
    throw err;
  }

  const user = session.user as unknown as SessionUser;

  // Re-check tenant status dari DB (terhindar race condition)
  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
  });

  if (!tenant || !isTenantAccessible(tenant.status)) {
    const err = new Error("TENANT_SUSPENDED");
    (err as unknown as { status: number }).status = 403;
    throw err;
  }

  return { user, tenant };
}

/**
 * Hash password (pakai bcrypt)
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// import bcrypt di akhir agar tree-shaking tidak masalah
import bcrypt from "bcryptjs";

/**
 * Verify password
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
