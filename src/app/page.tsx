import Link from "next/link";

export default function LandingPage() {
  const price = Number(process.env.SUBSCRIPTION_PRICE || 10000);
  const bankName = process.env.PAYMENT_BANK_NAME || "BCA";
  const accountNumber = process.env.PAYMENT_ACCOUNT_NUMBER || "5390986868";
  const accountName =
    process.env.PAYMENT_ACCOUNT_NAME || "HSRA HIDUP SEJAHTERA CV";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 no-print">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="font-bold text-xl text-brand-600">DapurSajiResto</div>
          <nav className="flex gap-4 items-center text-sm">
            <Link href="#fitur" className="text-gray-600 hover:text-gray-900">
              Fitur
            </Link>
            <Link href="#harga" className="text-gray-600 hover:text-gray-900">
              Harga
            </Link>
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium"
            >
              Daftar
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-50 to-orange-100 py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Sistem Restoran All-in-One
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Menu digital, pencatatan pesanan real-time (sinkron antar HP),
            struk otomatis + print Bluetooth. Semua dalam satu website.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/register"
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-8 py-3 rounded-lg text-lg"
            >
              Mulai Gratis 7 Hari
            </Link>
            <Link
              href="#fitur"
              className="bg-white border text-gray-700 font-semibold px-8 py-3 rounded-lg text-lg"
            >
              Lihat Fitur
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Tanpa kartu kredit · Setup 5 menit · Bisa dibatalkan kapan saja
          </p>
        </div>
      </section>

      {/* Fitur */}
      <section id="fitur" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Semua yang restoran Anda butuhkan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: "🍽️",
                title: "Menu Digital",
                desc: "Kelola menu mudah. Customer scan QR code lihat menu. Update harga & ketersediaan real-time.",
              },
              {
                icon: "📝",
                title: "Pencatatan Pesanan",
                desc: "Pelayan input pesanan dari HP, langsung masuk ke dapur. Sinkron real-time di semua device.",
              },
              {
                icon: "🔄",
                title: "Multi-Device Sync",
                desc: "Buka di HP 1 & HP 2, data otomatis sinkron. Pesanan baru langsung muncul di semua perangkat.",
              },
              {
                icon: "🍳",
                title: "Kitchen Display",
                desc: "Layar dapur menampilkan antrian pesanan real-time. Update status: masak → siap → saji.",
              },
              {
                icon: "🧾",
                title: "Struk Otomatis",
                desc: "Generate struk rapi ukuran 58mm/80mm. Print langsung ke printer thermal Bluetooth.",
              },
              {
                icon: "🖨️",
                title: "Print Bluetooth",
                desc: "Kirim struk ke printer thermal via Web Bluetooth (Chrome Android/Desktop). Fallback PDF untuk iOS.",
              },
              {
                icon: "👥",
                title: "Multi-User",
                desc: "Owner, kasir, pelayan - tiap role punya akses sesuai kebutuhan. Kelola tim Anda.",
              },
              {
                icon: "💳",
                title: "Subscription Otomatis",
                desc: "Auto-debit GoPay/OVO/ShopeePay tiap bulan. Email notifikasi otomatis saat pembayaran.",
              },
              {
                icon: "📊",
                title: "History & Laporan",
                desc: "Lihat semua pesanan & transaksi. Pantau penjualan harian dengan mudah.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-gray-50 rounded-xl p-6 hover:shadow-md transition"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Harga */}
      <section id="harga" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Harga Sederhana
          </h2>
          <p className="text-gray-600 mb-12">
            Satu paket, semua fitur. Tanpa biaya tersembunyi.
          </p>

          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto border-2 border-brand-500">
            <div className="text-brand-600 font-semibold mb-2">PAKET BASIC</div>
            <div className="mb-4">
              <span className="text-5xl font-bold text-gray-900">
                Rp {price.toLocaleString("id-ID")}
              </span>
              <span className="text-gray-500">/bulan</span>
            </div>
            <ul className="text-left text-sm space-y-2 mb-6">
              <li>✓ Menu digital unlimited</li>
              <li>✓ Pencatatan pesanan real-time</li>
              <li>✓ Multi-device sync</li>
              <li>✓ Kitchen display</li>
              <li>✓ Struk otomatis</li>
              <li>✓ Print Bluetooth</li>
              <li>✓ Multi-user (owner, kasir, pelayan)</li>
              <li>✓ History & laporan</li>
              <li>✓ Auto-debit e-wallet</li>
              <li>✓ Email notifikasi</li>
              <li>✓ Trial gratis 7 hari</li>
            </ul>
            <Link
              href="/register"
              className="block bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-lg"
            >
              Daftar Sekarang
            </Link>
          </div>

          <div className="mt-8 text-sm text-gray-500">
            <p>Metode pembayaran auto-debit:</p>
            <div className="flex gap-4 justify-center mt-2">
              <span>💳 GoPay</span>
              <span>💳 OVO</span>
              <span>💳 ShopeePay</span>
              <span>📱 QRIS</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-brand-600">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            Siap upgrade restoran Anda?
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Mulai gratis 7 hari. Tanpa risiko, tanpa kartu kredit.
          </p>
          <Link
            href="/register"
            className="inline-block bg-white text-brand-600 font-semibold px-8 py-3 rounded-lg text-lg"
          >
            Daftar Gratis Sekarang
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          <div className="font-bold text-white text-lg mb-2">DapurSajiResto</div>
          <p className="mb-2">
            Sistem restoran all-in-one untuk bisnis Indonesia
          </p>
          <p className="mb-4">
            Dioperasikan oleh {accountName}
          </p>
          <div className="border-t border-gray-800 pt-4 text-xs">
            <p>
              Pembayaran subscription dapat dilakukan via transfer ke{" "}
              {bankName} {accountNumber} a.n. {accountName}
            </p>
            <p className="mt-2">
              &copy; {new Date().getFullYear()} {accountName}. Semua hak dilindungi.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
