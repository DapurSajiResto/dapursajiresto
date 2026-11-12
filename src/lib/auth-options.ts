// NextAuth config - multi-tenant credentials auth
// Role: OWNER, KASIR, PELAYAN
//
// File ini dipisah dari route.ts karena Next.js tidak boleh export
// selain GET/POST dari file route.ts.

import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "./db";
import { isTenantAccessible } from "./tenant";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 hari
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: { tenant: true },
        });

        if (!user || !user.isActive) {
          return null;
        }

        // Cek tenant status - SUSPENDED & CANCELLED tidak boleh login
        if (!isTenantAccessible(user.tenant.status)) {
          if (user.tenant.status === "SUSPENDED") {
            throw new Error("AKUN_DISESUSPEND");
          }
          throw new Error("AKUN_TIDAK_AKTIF");
        }

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          subdomain: user.tenant.subdomain,
          namaResto: user.tenant.namaResto,
        } as unknown as {
          id: string;
          email: string;
          name: string;
          role: string;
          tenantId: string;
          subdomain: string;
          namaResto: string;
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as {
          id: string;
          role: string;
          tenantId: string;
          subdomain: string;
          namaResto: string;
        };
        token.id = u.id;
        token.role = u.role;
        token.tenantId = u.tenantId;
        token.subdomain = u.subdomain;
        token.namaResto = u.namaResto;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as Record<string, unknown>).id = token.id;
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).tenantId =
          token.tenantId;
        (session.user as unknown as Record<string, unknown>).subdomain =
          token.subdomain;
        (session.user as unknown as Record<string, unknown>).namaResto =
          token.namaResto;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
