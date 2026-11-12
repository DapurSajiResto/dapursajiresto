import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "DapurSajiResto - Sistem Restoran All-in-One",
  description:
    "Website restoran SaaS: menu digital, pesanan real-time multi-device, struk & printer Bluetooth. Mulai Rp 10.000/bulan.",
  keywords: [
    "sistem restoran",
    "pos restoran",
    "menu digital",
    "kasir restoran",
    "saas restoran",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
