// API: Dashboard stats
// GET /api/dashboard/stats - ringkasan untuk home dashboard

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const { user } = await requireAuth();

    // Awal hari ini (WIB)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [todayOrders, todayRevenue, activeOrders, menuItems] =
      await Promise.all([
        prisma.order.count({
          where: {
            tenantId: user.tenantId,
            createdAt: { gte: startOfDay, lte: endOfDay },
          },
        }),
        prisma.transaction.aggregate({
          where: {
            tenantId: user.tenantId,
            createdAt: { gte: startOfDay, lte: endOfDay },
          },
          _sum: { total: true },
        }),
        prisma.order.count({
          where: {
            tenantId: user.tenantId,
            status: { in: ["PENDING", "COOKING", "READY", "SERVED"] },
          },
        }),
        prisma.menuItem.count({
          where: { tenantId: user.tenantId },
        }),
      ]);

    return NextResponse.json({
      todayOrders,
      todayRevenue: todayRevenue._sum.total || 0,
      activeOrders,
      menuItems,
    });
  } catch (err) {
    const e = err as unknown as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message || "UNAUTHORIZED" },
      { status: e.status || 401 }
    );
  }
}
