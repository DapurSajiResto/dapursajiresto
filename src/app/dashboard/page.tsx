"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";

export default function DashboardHome() {
  const { data: session } = useSession();
  const [stats, setStats] = useState({
    todayOrders: 0,
    todayRevenue: 0,
    activeOrders: 0,
    menuItems: 0,
  });

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <DashboardShell>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Halo, {(session?.user as unknown as { namaResto?: string })?.namaResto} 👋
        </h1>
        <p className="text-gray-500 mb-6">
          Selamat datang di dashboard DapurSajiResto
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Pesanan Hari Ini"
            value={stats.todayOrders}
            icon="📋"
          />
          <StatCard
            label="Pendapatan Hari Ini"
            value={`Rp ${stats.todayRevenue.toLocaleString("id-ID")}`}
            icon="💰"
          />
          <StatCard
            label="Pesanan Aktif"
            value={stats.activeOrders}
            icon="🔥"
          />
          <StatCard
            label="Total Menu"
            value={stats.menuItems}
            icon="🍽️"
          />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ActionCard
            href="/dashboard/pos"
            title="Buat Pesanan Baru"
            desc="Input pesanan dari pelayan, kirim ke dapur"
            icon="📝"
          />
          <ActionCard
            href="/dashboard/kitchen"
            title="Lihat Dapur"
            desc="Kitchen display real-time"
            icon="🍳"
          />
          <ActionCard
            href="/dashboard/struk"
            title="Cetak Struk"
            desc="Generate & print struk Bluetooth"
            icon="🧾"
          />
          <ActionCard
            href="/dashboard/menu"
            title="Kelola Menu"
            desc="Tambah/edit item menu"
            icon="🍽️"
          />
          <ActionCard
            href="/dashboard/orders"
            title="Riwayat Pesanan"
            desc="Lihat semua pesanan"
            icon="📋"
          />
          <ActionCard
            href="/dashboard/subscription"
            title="Langganan"
            desc="Status & pembayaran"
            icon="💳"
          />
        </div>
      </div>
    </DashboardShell>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  desc,
  icon,
}: {
  href: string;
  title: string;
  desc: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white border rounded-xl p-5 hover:shadow-md hover:border-brand-300 transition"
    >
      <div className="text-3xl mb-2">{icon}</div>
      <div className="font-semibold text-gray-900">{title}</div>
      <div className="text-sm text-gray-500 mt-1">{desc}</div>
    </Link>
  );
}
