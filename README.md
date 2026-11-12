# DapurSajiResto - Sistem Restoran All-in-One

Website restoran SaaS: menu digital, pencatatan pesanan real-time (sinkron antar device), struk otomatis + print Bluetooth, sistem subscription Rp 10.000/bulan dengan auto-debit e-wallet.

## Fitur Utama

- **Menu Digital** — CRUD kategori & item menu, QR code per meja, tampilan publik untuk customer
- **Pencatatan Pesanan Real-time** — Input dari pelayan → langsung masuk kitchen display. Sinkron antar HP via Socket.IO
- **Kitchen Display** — Layar dapur menampilkan antrian pesanan live
- **Struk + Print Bluetooth** — Generate struk ESC/POS, kirim ke printer thermal via Web Bluetooth (Chrome Android/Desktop), fallback PDF untuk iOS
- **Multi-User** — Owner, Kasir, Pelayan dengan role-based access
- **Subscription Auto-Debit** — Rp 10.000/bulan via Midtrans recurring (GoPay/OVO/ShopeePay/QRIS)
- **Email Otomatis** — Notifikasi bulanan saat pembayaran berhasil/gagal, suspend notice, trial reminder
- **Auto-Suspend** — Akun otomatis di-suspend setelah 3x gagal pembayaran

## Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 14 (App Router) + React + TailwindCSS |
| Database | PostgreSQL + Prisma ORM |
| Real-time | Socket.IO |
| Auth | NextAuth.js (credentials, multi-tenant) |
| Payment | Midtrans (recurring + e-wallet) |
| Email | Resend |
| Print | Web Bluetooth API + ESC/POS |

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Setup environment

```bash
cp .env.example .env.local
```

Edit `.env.local` dan isi:

- `DATABASE_URL` — PostgreSQL connection string (rekomendasi: [Neon](https://neon.tech) free tier)
- `NEXTAUTH_SECRET` — generate dengan `openssl rand -base64 32`
- `NEXTAUTH_URL` — `http://localhost:3000` (dev) atau domain production
- `BASE_DOMAIN` — domain utama Anda (misal `namadomain.com`)
- `MIDTRANS_SERVER_KEY` & `MIDTRANS_CLIENT_KEY` — dari [Midtrans Dashboard](https://dashboard.sandbox.midtrans.com) (sandbox untuk dev)
- `RESEND_API_KEY` — dari [Resend](https://resend.com)
- `CRON_SECRET` — random string untuk proteksi cron endpoint

### 3. Setup database

```bash
pnpm prisma:migrate dev --name init
# atau kalau belum setup migration:
pnpm prisma:push
```

### 4. Run development server

```bash
pnpm dev
```

Buka http://localhost:3000

## Setup Production

### Midtrans (Payment Gateway)

1. Daftar di https://dashboard.midtrans.com (sandbox dulu untuk testing)
2. Lengkapi KYC merchant pakai data CV:
   - **Nama**: HSRA HIDUP SEJAHTERA CV
   - **Bank**: BCA
   - **No. Rekening**: 5390986868
3. Setelah approve, ganti env:
   - `MIDTRANS_SERVER_KEY` → production key
   - `MIDTRANS_CLIENT_KEY` → production key
   - `MIDTRANS_API_BASE_URL=https://api.midtrans.com`
   - `MIDTRANS_IS_PRODUCTION=true`
4. Set webhook URL di Midtrans dashboard: `https://namadomain.com/api/payment/webhook`

### Domain & Subdomain Multi-Tenant

1. Beli domain (misal `namadomain.com`)
2. Setup DNS wildcard: `*.namadomain.com → Vercel`
3. Set `BASE_DOMAIN=namadomain.com`
4. Tiap resto dapat subdomain: `restoa.namadomain.com`

### Cron Job (Auto-Payment)

**Option A: Vercel Cron** (sudah dikonfigurasi di `vercel.json`)

Vercel otomatis call `/api/cron/daily` tiap hari jam 00:30 WIB (17:30 UTC).
Set env `CRON_SECRET` lalu set di Vercel Dashboard:
- Settings → Cron → Authorization header: `Bearer <CRON_SECRET>`

**Option B: External cron (cron-job.org)**

- URL: `https://namadomain.com/api/cron/daily?secret=YOUR_CRON_SECRET`
- Schedule: daily, jam 00:30 WIB (17:30 UTC)

### Email (Resend)

1. Daftar di https://resend.com
2. Verify domain Anda
3. Set `RESEND_API_KEY` dan `EMAIL_FROM=DapurSajiResto <noreply@namadomain.com>`

## Struktur Proyek

```
src/
├── app/
│   ├── page.tsx                          # Landing page (sales)
│   ├── login/                            # Halaman login
│   ├── register/                         # Daftar resto baru
│   ├── suspended/                        # Halaman akun suspend
│   ├── dashboard/                        # Dashboard resto
│   │   ├── page.tsx                      # Home (stats)
│   │   ├── menu/                         # Kelola menu
│   │   ├── pos/                          # Input pesanan
│   │   ├── kitchen/                      # Kitchen display
│   │   ├── orders/                       # Riwayat pesanan
│   │   ├── struk/                        # Struk & print
│   │   └── subscription/                 # Langganan
│   └── api/
│       ├── auth/[...nextauth]/           # NextAuth
│       ├── register/                     # API register
│       ├── menu/                         # CRUD menu
│       ├── orders/                       # CRUD pesanan
│       ├── print/[orderId]/              # Generate struk data
│       ├── dashboard/stats/              # Stats dashboard
│       ├── payment/
│       │   ├── subscribe/                # Setup subscription
│       │   └── webhook/                  # Midtrans webhook
│       ├── public/menu/                  # Menu publik (customer)
│       └── cron/daily/                   # Cron job auto-payment
├── components/
│   ├── DashboardShell.tsx                # Layout dashboard + sidebar
│   ├── BluetoothPrinterButton.tsx        # Web Bluetooth print logic
│   ├── StrukPreview.tsx                  # Preview struk + PDF fallback
│   └── Providers.tsx                     # SessionProvider wrapper
├── lib/
│   ├── db.ts                             # Prisma client singleton
│   ├── auth.ts                           # requireAuth helper
│   ├── tenant.ts                         # Subdomain resolver
│   ├── socket.ts                         # Socket.IO server
│   ├── socket-client.ts                  # Socket.IO client hook
│   ├── midtrans.ts                       # Midtrans integration
│   ├── email.ts                          # Email templates + send
│   └── escpos.ts                         # ESC/POS byte generator
├── types/
│   └── next-auth.d.ts                    # NextAuth type extensions
└── middleware.ts                         # Auth + routing

prisma/
└── schema.prisma                         # Database schema (10 tables)
```

## Alur Subscription

```
1. Resto daftar → status TRIAL (7 hari gratis)
2. Setup pembayaran (pilih e-wallet)
3. Charge pertama Rp 10.000 via Midtrans
4. Webhook terima notif → setup recurring subscription
5. Tiap bulan: cron cek currentPeriodEnd
   - Jika jatuh tempo → charge otomatis
   - Sukses → email "Pembayaran berhasil" + extend 1 bulan
   - Gagal → retry 3x (D+1, D+3, D+5)
     - Gagal semua → SUSPEND + email "Akun di-suspend"
6. Suspend = login diblokir, data disimpan 90 hari
```

## Limitasi yang Perlu Diketahui

### 1. Print Bluetooth
- **Web Bluetooth API** hanya jalan di **Chrome Android & desktop**, **TIDAK di iPhone/iOS Safari**
- Fallback: tombol "Print via Browser" (PDF 58mm/80mm) untuk iOS
- Kompatibel dengan printer thermal ESC/POS umum (Goojprt, Xprinter, Zjiang, EPSON TM)

### 2. Auto-Debit E-Wallet
- OVO/GoPay/ShopeePay **tidak punya API publik** untuk auto-debit sembarang merchant
- Solusi: lewat **Midtrans** (payment gateway resmi) yang sudah terintegrasi
- Butuh KYC merchant pakai data CV
- Ada biaya transaksi ~2-3% per Rp 10.000

### 3. Real-time Sync
- Socket.IO butuh server persistent connection (Vercel serverless kurang ideal)
- Untuk production: jalankan Socket.IO server terpisah di Railway/Fly.io/VPS
- Atau pakai Supabase Realtime sebagai alternatif

## Testing

### Midtrans Sandbox
- Pakai `SB-` keys (sandbox)
- Test payment GoPay: pakai nomor test dari Midtrans docs
- Webhook: pakai ngrok untuk terima notif di localhost

### Print Bluetooth
- Test dengan printer thermal fisik (58mm atau 80mm)
- Buka dashboard dari Chrome Android, klik "Print Bluetooth"
- Pilih printer dari dialog

## License

Proprietary - HSRA HIDUP SEJAHTERA CV
