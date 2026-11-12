"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Beranda", icon: "🏠", short: "Beranda" },
  { href: "/dashboard/pos", label: "Pesanan Baru", icon: "📝", short: "Pesanan" },
  { href: "/dashboard/orders", label: "Daftar Pesanan", icon: "📋", short: "Riwayat" },
  { href: "/dashboard/kitchen", label: "Dapur", icon: "🍳", short: "Dapur" },
  { href: "/dashboard/menu", label: "Menu", icon: "🍽️", short: "Menu" },
  { href: "/dashboard/struk", label: "Struk", icon: "🧾", short: "Struk" },
  { href: "/dashboard/pengaturan", label: "Pengaturan", icon: "⚙️", short: "Atur" },
  { href: "/dashboard/subscription", label: "Langganan", icon: "💳", short: "Langganan" },
];

// Bottom nav: hanya 5 item utama (sisanya di "Lainnya")
const BOTTOM_NAV = NAV.slice(0, 4).concat([{ ...NAV[6], short: "Atur" }]); // Beranda, Pesanan, Riwayat, Dapur, Atur

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - desktop only */}
      <aside className="hidden lg:flex w-60 bg-white border-r flex-col no-print fixed inset-y-0 left-0 z-20">
        <div className="p-4 border-b">
          <div className="font-bold text-lg text-brand-600">DapurSajiResto</div>
          {session?.user && (
            <div className="text-xs text-gray-500 mt-1 truncate">
              {(session.user as unknown as { namaResto: string }).namaResto}
            </div>
          )}
        </div>
        <nav className="flex-1 p-2 overflow-y-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition ${
                isActive(item.href)
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t">
          {session?.user && (
            <div className="text-xs text-gray-500 mb-2 truncate px-1">
              {session.user.email}
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full text-left text-sm text-gray-600 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition"
          >
            Keluar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-60 overflow-x-hidden">{children}</main>

      {/* Bottom nav - mobile/tablet only */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t flex items-center justify-around z-30 no-print h-16 safe-area-bottom">
        {BOTTOM_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs ${
              isActive(item.href) ? "text-brand-600 font-medium" : "text-gray-500"
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-[10px]">{item.short}</span>
          </Link>
        ))}
        <button
          onClick={() => setShowMore(true)}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs text-gray-500"
        >
          <span className="text-lg leading-none">⋯</span>
          <span className="text-[10px]">Lainnya</span>
        </button>
      </nav>

      {/* More menu - mobile */}
      {showMore && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4 pb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Menu Lainnya</h3>
              <button onClick={() => setShowMore(false)} className="text-gray-400 text-xl">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMore(false)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl ${
                    isActive(item.href) ? "bg-brand-50 text-brand-700" : "bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-xs text-center">{item.short}</span>
                </Link>
              ))}
              <button
                onClick={() => {
                  setShowMore(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-red-50 text-red-600"
              >
                <span className="text-xl">🚪</span>
                <span className="text-xs">Keluar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
