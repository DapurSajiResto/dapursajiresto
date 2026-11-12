# Panduan Setup DapurSajiResto untuk Non-IT

> **Anda tidak perlu paham coding.** Ikuti langkah berikut satu per satu, urut dari atas ke bawah. Tiap langkah cuma butuh klik & ketik di website.

---

## Ringkasan: 3 Akun yang Harus Anda Daftar

| # | Akun | Untuk apa | Biaya | Waktu |
|---|------|-----------|-------|-------|
| 1 | **Neon** (database) | Simpan data semua resto | GRATIS | 5 menit |
| 2 | **Resend** (email) | Kirim email notifikasi pembayaran | GRATIS (3.000 email/bulan) | 10 menit |
| 3 | **Midtrans** (pembayaran) | Auto-debit OVO/GoPay/ShopeePay | GRATIS daftar, fee ~2-3% per transaksi | 15 menit upload + 1-3 hari approval |

> Setelah ketiganya jadi, Anda kasih saya key/password dari masing-masing, saya yang konfigurasi & deploy sisanya.

---

## LANGKAH 1: Daftar Database (Neon) — 5 menit

Database = tempat menyimpan semua data (menu, pesanan, akun resto, dll).

1. Buka browser, ketik: **https://neon.tech**
2. Klik tombol **"Sign up"** (pojok kanan atas)
3. Klik **"Continue with Google"** atau **"Continue with GitHub"** (pilih yang Anda punya)
4. Setelah login, klik tombol **"Create Project"** atau **"New Project"**
5. Isi:
   - **Project name**: ketik `dapursajiresto`
   - **Database name**: biarkan `neondb` (tidak perlu ubah)
   - **Region**: pilih `AWS Asia Pacific (Singapore)` — paling dekat Indonesia
   - **Postgres version**: biarkan default
6. Klik **"Create Project"**
7. Setelah jadi, akan muncul halaman dengan **"Connection string"** — teks panjang yang dimulai dengan `postgresql://...`

### Yang harus Anda kasih ke saya:
> **Copy teks "Connection string"** itu (panjang, dimulai dari `postgresql://`). Itu yang akan saya masukkan ke konfigurasi.
>
> Contoh bentuknya: `postgresql://namuser:password@ep-xxx.neon.tech/neondb?sslmode=require`

---

## LANGKAH 2: Daftar Email (Resend) — 10 menit

Resend dipakai untuk kirim email otomatis ke customer (notifikasi pembayaran berhasil/gagal, dll).

1. Buka browser, ketik: **https://resend.com**
2. Klik **"Sign up"** (pojok kanan atas)
3. Klik **"Continue with Google"** atau **"Continue with GitHub"**
4. Setelah login, Anda akan di halaman Dashboard
5. Di menu kiri, klik **"API Keys"**
6. Klik tombol **"Create API Key"**
7. Isi:
   - **Name**: ketik `dapursajiresto`
   - **Permission**: pilih **"Sending access"**
   - **Domain**: biarkan default (`resend.dev` untuk awal)
8. Klik **"Create"**
9. Akan muncul API Key (teks dimulai dengan `re_...`)

### Yang harus Anda kasih ke saya:
> **Copy API Key** (dimulai dengan `re_...`). Jangan tutup halaman ini sebelum copy — key hanya muncul sekali.

### Catatan tentang domain email:
Untuk awal, email akan dikirim dari alamat `onboarding@resend.dev` (cukup untuk testing). Kalau mau pakai domain sendiri (misal `noreply@dapursajiresto.id`), nanti saya bantu setup setelah Anda beli domain.

---

## LANGKAH 3: Daftar Pembayaran (Midtrans) — 15 menit upload + 1-3 hari approval

Ini yang paling penting. Midtrans = payment gateway resmi yang bisa auto-debit OVO/GoPay/ShopeePay. **Wajib KYC pakai data CV Anda.**

### Siapkan dokumen dulu (scan/foto, format JPG/PDF):

| Dokumen | Wajib? | Catatan |
|---------|--------|---------|
| KTP penanggung jawab CV | ✅ Wajib | Foto/scan jelas, tidak buram |
| NPWP perusahaan (CV) | ✅ Wajib | Atas nama "HSRA HIDUP SEJAHTERA CV" |
| Akta pendirian CV | ✅ Wajib | Dari notaris |
| SK Kemenkumham (kalau PT) | ❌ Tidak untuk CV | Skip kalau CV |
| Rekening BCA 5390986868 | ✅ Wajib | Buku tabungan / statement |

### Cara daftar:

1. Buka browser, ketik: **https://dashboard.midtrans.com**
2. Klik **"Sign up"** atau **"Register"**
3. Isi form pendaftaran:
   - **Nama bisnis**: `HSRA HIDUP SEJAHTERA CV`
   - **Email**: pakai email Anda yang aktif (yang sering dicek)
   - **Password**: buat password kuat, catat di tempat aman
   - **No. telepon**: nomor HP Anda yang aktif
4. Klik **"Register"**
5. Cek email Anda, klik link verifikasi dari Midtrans
6. Setelah verifikasi, login ke dashboard Midtrans
7. Anda akan diminta lengkapi **"Profil Merchant"** / **"Verification"**:
   - Upload KTP penanggung jawab
   - Upload NPWP perusahaan
   - Upload akta CV
   - Upload bukti rekening BCA
   - Isi data bank: BCA, no. rekening 5390986868, a.n. HSRA HIDUP SEJAHTERA CV
8. Submit dan **tunggu approval** (1-3 hari kerja). Midtrans akan kirim email notifikasi.

### Setelah approve (1-3 hari kemudian):
1. Login ke https://dashboard.midtrans.com
2. Di menu kiri, cari **"Settings"** → **"Access Keys"** atau **"API Keys"**
3. Akan muncul 2 key:
   - **Server Key** (dimulai dengan `SB-Mid-server-...` untuk sandbox, atau `Mid-server-...` untuk production)
   - **Client Key** (dimulai dengan `SB-Mid-client-...` atau `Mid-client-...`)

### Yang harus Anda kasih ke saya:
> **Copy Server Key dan Client Key.** Pastikan Anda di mode **Production** (bukan Sandbox) — biasanya ada toggle di pojok kanan atas dashboard.

---

## LANGKAH 4: Beli Domain — opsional untuk awal, wajib untuk jual

Domain = alamat website Anda (misal `dapursajiresto.id`). Ini yang dikasih ke customer.

1. Buka **https://www.niagahoster.co.id** atau **https://www.domainesia.com** (penyedia domain Indonesia, support pembayaran lokal)
2. Cari kolom "Cari Domain", ketik `dapursajiresto`
3. Pilih ekstensi:
   - `.id` → lebih profesional untuk bisnis Indonesia (~Rp 250.000/tahun)
   - `.com` → lebih murah (~Rp 150.000/tahun)
4. Klik **"Beli"** / **"Checkout"**
5. Buat akun di penyedia domain, lakukan pembayaran (transfer BCA / e-wallet)
6. Setelah pembayaran confirmed, domain Anda aktif dalam 1-24 jam

### Yang harus Anda kasih ke saya:
> **Kasih tahu nama domain yang Anda beli** (misal `dapursajiresto.id`) + **akun login ke panel domain** (atau Anda yang setup DNSWildcards nanti, saya kasih panduan khusus — cuma 1 langkah).

---

## LANGKAH 5: Deploy Website — saya yang urus

Setelah Anda kasih saya:
- ✅ Connection string Neon (Langkah 1)
- ✅ API Key Resend (Langkah 2)
- ✅ Server Key + Client Key Midtrans (Langkah 3, setelah approve)
- ✅ Nama domain (Langkah 4)

**Saya yang akan:**
1. Konfigurasi semua key ke dalam sistem
2. Deploy website ke Vercel (hosting gratis)
3. Setup auto-payment harian (cron job)
4. Setup Socket.IO server untuk real-time sync
5. Test semuanya berfungsi
6. Kasih tahu Anda link website yang sudah online

---

## FAQ — Pertanyaan yang Mungkin Muncul

**Q: Kalau Midtrans KYC ditolak, gimana?**
A: Penyebab umum: dokumen buram, data tidak match, atau NPWP belum atas nama CV. Perbaiki dokumen & submit ulang. Kalau bermasalah parah, ada alternatif: pakai **Xendit** atau **DOKU** (juga payment gateway, proses serupa).

**Q: Kalau tidak mau pakai Midtrans, bisa pakai transfer manual?**
A: Bisa. Sistem sudah punya fallback: user transfer Rp 10.000 ke BCA 5390986868 tiap bulan, Anda/admin verifikasi manual. Tapi ini **bukan auto-debit** — user harus inisiatif transfer. Saya bisa aktifkan mode ini kalau Midtrans belum approve.

**Q: Berapa total biaya per bulan setelah launch?**
A: Untuk awal (di bawah 50 resto): **Rp 0** — semua free tier. Setelah skala besar baru perlu upgrade (~Rp 200-500rb/bulan tergantung jumlah resto).

**Q: Saya tetap bingung, bisa minta bantuan langsung?**
A: Bisa. Kalau ada langkah yang stuck, kasih tahu saya langkah ke berapa yang bingung, saya bantu step-by-step lebih detail.

---

## Checklist Akhir

Ceklist ini untuk memastikan semua sudah selesai:

- [ ] Langkah 1: Daftar Neon, dapat connection string
- [ ] Langkah 2: Daftar Resend, dapat API Key
- [ ] Langkah 3: Daftar Midtrans, upload dokumen, tunggu approve, dapat Server Key + Client Key
- [ ] Langkah 4: Beli domain
- [ ] Langkah 5: Kasih semua key ke saya, saya deploy

**Sampai langkah 5 selesai, website Anda siap dijual ke customer.**
