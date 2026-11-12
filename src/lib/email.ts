// Email service - kirim email transaksional via Resend
// + 4 template email untuk subscription billing
//
// Templates:
//   1. payment_success    - pembayaran berhasil, akses diperpanjang
//   2. payment_failed     - pembayaran gagal, akan retry
//   3. suspend_notice     - akun di-suspend
//   4. trial_ending       - pengingat trial berakhir
//
// Resend: https://resend.com/docs
// Fallback: bila RESEND_API_KEY tidak set, log ke console (dev mode)

import { Resend } from "resend";
import prisma from "./db";
import { EmailType, EmailStatus } from "@prisma/client";

const apiKey = process.env.RESEND_API_KEY || "";
const FROM = process.env.EMAIL_FROM || "DapurSajiResto <noreply@localhost>";
const SUPPORT = process.env.EMAIL_SUPPORT || "support@localhost";

const resend = apiKey ? new Resend(apiKey) : null;

// ============================================================
// Info pembayaran (dari env)
// ============================================================
const PAYMENT_INFO = {
  bankName: process.env.PAYMENT_BANK_NAME || "BCA",
  accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || "5390986868",
  accountName: process.env.PAYMENT_ACCOUNT_NAME || "HSRA HIDUP SEJAHTERA CV",
  price: Number(process.env.SUBSCRIPTION_PRICE || 10000),
  companyName: process.env.COMPANY_NAME || "HSRA HIDUP SEJAHTERA CV",
};

// ============================================================
// Render template HTML
// ============================================================
function baseTemplate(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 28px 32px; color: white; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
    .header p { margin: 6px 0 0; opacity: 0.92; font-size: 14px; }
    .body { padding: 32px; }
    .body h2 { color: #111827; font-size: 18px; margin: 0 0 16px; }
    .body p { line-height: 1.65; color: #374151; font-size: 15px; margin: 0 0 14px; }
    .receipt { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .receipt-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .receipt-total { border-top: 2px dashed #d1d5db; margin-top: 10px; padding-top: 12px; font-weight: 700; font-size: 16px; color: #f97316; }
    .btn { display: inline-block; background: #f97316; color: white !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; font-size: 15px; }
    .alert { padding: 14px 18px; border-radius: 8px; margin: 16px 0; font-size: 14px; }
    .alert-warning { background: #fef3c7; color: #92400e; border-left: 4px solid #f59e0b; }
    .alert-danger { background: #fee2e2; color: #991b1b; border-left: 4px solid #dc2626; }
    .alert-success { background: #d1fae5; color: #065f46; border-left: 4px solid #10b981; }
    .footer { padding: 24px 32px; background: #f9fafb; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .footer strong { color: #374151; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DapurSajiResto</h1>
      <p>Sistem Restoran - Notifikasi Langganan</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>Email ini dikirim otomatis oleh sistem <strong>DapurSajiResto</strong> dari <strong>${PAYMENT_INFO.companyName}</strong>.</p>
      <p>Untuk bantuan, balas email ini atau hubungi: <strong>${SUPPORT}</strong></p>
      <p>&copy; ${new Date().getFullYear()} ${PAYMENT_INFO.companyName}. Semua hak dilindungi.</p>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================
// Format tanggal Indonesia
// ============================================================
function formatTanggalID(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

// ============================================================
// Template 1: Payment Success
// ============================================================
export function paymentSuccessTemplate(params: {
  namaResto: string;
  amount: number;
  ewalletType: string;
  periodeAkhir: Date;
  tanggalBayar: Date;
  nomorRef: string;
}): { subject: string; html: string } {
  const { namaResto, amount, ewalletType, periodeAkhir, tanggalBayar, nomorRef } = params;
  const subject = `Pembayaran Berhasil - Langganan ${namaResto} diperpanjang 1 bulan`;

  const content = `
    <h2>Pembayaran Berhasil ✓</h2>
    <p>Halo <strong>${namaResto}</strong>,</p>
    <p>Pembayaran langganan bulanan DapurSajiResto Anda <strong>berhasil dilakukan secara otomatis</strong>. Akses ke sistem Anda telah diperpanjang selama 1 bulan.</p>
    <div class="receipt">
      <div class="receipt-row"><span>Nama Resto</span><strong>${namaResto}</strong></div>
      <div class="receipt-row"><span>Jumlah</span><strong>${formatRupiah(amount)}</strong></div>
      <div class="receipt-row"><span>Metode</span><strong>${ewalletType}</strong></div>
      <div class="receipt-row"><span>Tanggal Pembayaran</span><strong>${formatTanggalID(tanggalBayar)}</strong></div>
      <div class="receipt-row"><span>No. Referensi</span><strong>${nomorRef}</strong></div>
      <div class="receipt-row receipt-total"><span>Aktif Sampai</span><span>${formatTanggalID(periodeAkhir)}</span></div>
    </div>
    <div class="alert alert-success">
      ✅ Akun Anda aktif. Anda bisa langsung menggunakan semua fitur DapurSajiResto (menu, pesanan, struk, printer Bluetooth).
    </div>
    <p>Terima kasih telah berlangganan. Untuk pertanyaan, balas email ini.</p>
    <p>Salam,<br><strong>Tim DapurSajiResto</strong></p>
  `;

  return { subject, html: baseTemplate(content, subject) };
}

// ============================================================
// Template 2: Payment Failed (akan retry)
// ============================================================
export function paymentFailedTemplate(params: {
  namaResto: string;
  amount: number;
  ewalletType: string;
  retryCount: number;
  nextRetryAt: Date;
  failureReason?: string;
}): { subject: string; html: string } {
  const { namaResto, amount, ewalletType, retryCount, nextRetryAt, failureReason } = params;
  const subject = `Pembayaran Gagal - Langganan ${namaResto} (akan dicoba lagi)`;

  const content = `
    <h2>Pembayaran Gagal ✗</h2>
    <p>Halo <strong>${namaResto}</strong>,</p>
    <p>Pembayaran langganan bulanan Anda <strong>gagal diproses</strong> via ${ewalletType}. Kemungkinan penyebab: saldo tidak cukup, e-wallet tidak aktif, atau masalah koneksi.</p>
    <div class="receipt">
      <div class="receipt-row"><span>Nama Resto</span><strong>${namaResto}</strong></div>
      <div class="receipt-row"><span>Jumlah</span><strong>${formatRupiah(amount)}</strong></div>
      <div class="receipt-row"><span>Metode</span><strong>${ewalletType}</strong></div>
      ${failureReason ? `<div class="receipt-row"><span>Alasan</span><strong>${failureReason}</strong></div>` : ""}
      <div class="receipt-row"><span>Percobaan</span><strong>${retryCount} dari 3</strong></div>
      <div class="receipt-row"><span>Akan Dicoba Lagi</span><strong>${formatTanggalID(nextRetryAt)}</strong></div>
    </div>
    <div class="alert alert-warning">
      ⚠️ Sistem akan mencoba charge otomatis kembali pada tanggal retry di atas. Pastikan saldo ${ewalletType} Anda mencukupi.
    </div>
    <p>Anda tetap bisa mengakses sistem selama masa retry. Jika setelah 3x percobaan tetap gagal, akun akan di-suspend.</p>
    <p>Untuk mengganti metode pembayaran, silakan login ke dashboard dan buka menu <strong>Langganan</strong>.</p>
    <p>Salam,<br><strong>Tim DapurSajiResto</strong></p>
  `;

  return { subject, html: baseTemplate(content, subject) };
}

// ============================================================
// Template 3: Suspend Notice (akses dihentikan)
// ============================================================
export function suspendNoticeTemplate(params: {
  namaResto: string;
  amount: number;
  lastAttemptDate: Date;
}): { subject: string; html: string } {
  const { namaResto, amount, lastAttemptDate } = params;
  const subject = `Akun Di-Suspend - Akses ${namaResto} dihentikan`;

  const content = `
    <h2>Akses Akun Dihentikan ✗</h2>
    <p>Halo <strong>${namaResto}</strong>,</p>
    <p>Akses ke sistem DapurSajiResto Anda telah <strong>di-SUSPEND</strong> karena pembayaran langganan bulanan gagal setelah 3x percobaan.</p>
    <div class="receipt">
      <div class="receipt-row"><span>Nama Resto</span><strong>${namaResto}</strong></div>
      <div class="receipt-row"><span>Tagihan Tertunggak</span><strong>${formatRupiah(amount)}</strong></div>
      <div class="receipt-row"><span>Percobaan Terakhir</span><strong>${formatTanggalID(lastAttemptDate)}</strong></div>
    </div>
    <div class="alert alert-danger">
      🚫 Login ke dashboard, menu, pesanan, dan struk <strong>sudah tidak bisa diakses</strong> hingga pembayaran diselesaikan.
    </div>
    <p><strong>Cara mengaktifkan kembali akun:</strong></p>
    <p>1. Bayar tagihan tertunggak via transfer ke:</p>
    <div class="receipt">
      <div class="receipt-row"><span>Bank</span><strong>${PAYMENT_INFO.bankName}</strong></div>
      <div class="receipt-row"><span>No. Rekening</span><strong>${PAYMENT_INFO.accountNumber}</strong></div>
      <div class="receipt-row"><span>Atas Nama</span><strong>${PAYMENT_INFO.accountName}</strong></div>
      <div class="receipt-row"><span>Jumlah</span><strong>${formatRupiah(amount)}</strong></div>
    </div>
    <p>2. Setelah transfer, login ke dashboard, buka menu <strong>Langganan</strong>, upload bukti transfer atau update metode pembayaran e-wallet.</p>
    <p>3. Akun akan diaktifkan kembali dalam max 1x24 jam setelah verifikasi.</p>
    <div class="alert alert-warning">
      ℹ️ Data Anda <strong>tetap disimpan 90 hari</strong> sejak tanggal suspend. Setelah itu akan dihapus permanen jika belum diaktifkan.
    </div>
    <p>Salam,<br><strong>Tim DapurSajiResto</strong></p>
  `;

  return { subject, html: baseTemplate(content, subject) };
}

// ============================================================
// Template 4: Trial Ending
// ============================================================
export function trialEndingTemplate(params: {
  namaResto: string;
  trialEndsAt: Date;
}): { subject: string; html: string } {
  const { namaResto, trialEndsAt } = params;
  const subject = `Masa Trial Berakhir Segera - ${namaResto}`;

  const content = `
    <h2>Masa Trial Akan Berakhir ⏰</h2>
    <p>Halo <strong>${namaResto}</strong>,</p>
    <p>Masa uji coba gratis DapurSajiResto Anda akan berakhir dalam <strong>1 hari</strong> pada:</p>
    <div class="receipt">
      <div class="receipt-row"><span>Nama Resto</span><strong>${namaResto}</strong></div>
      <div class="receipt-row"><span>Berakhir Pada</span><strong>${formatTanggalID(trialEndsAt)}</strong></div>
    </div>
    <p>Agar akun tetap aktif dan bisa dipakai untuk pelayanan pelanggan, silakan <strong>setup metode pembayaran</strong> sebelum masa trial berakhir.</p>
    <div class="receipt">
      <div class="receipt-row"><span>Harga Langganan</span><strong>${formatRupiah(PAYMENT_INFO.price)} / bulan</strong></div>
    </div>
    <p>Metode pembayaran yang tersedia:</p>
    <p>• <strong>Auto-debit e-wallet</strong>: GoPay, OVO, ShopeePay (otomatis dipotong tiap bulan)</p>
    <p>• <strong>QRIS</strong>: semua e-wallet Indonesia</p>
    <p>• <strong>Transfer BCA</strong>: ${PAYMENT_INFO.accountNumber} a.n. ${PAYMENT_INFO.accountName}</p>
    <a href="${process.env.NEXTAUTH_URL}/dashboard/subscription" class="btn">Setup Pembayaran Sekarang</a>
    <div class="alert alert-warning">
      ⚠️ Jika tidak setup pembayaran sebelum trial berakhir, akun akan otomatis di-suspend.
    </div>
    <p>Salam,<br><strong>Tim DapurSajiResto</strong></p>
  `;

  return { subject, html: baseTemplate(content, subject) };
}

// ============================================================
// Template 5: Welcome / Trial Started
// ============================================================
export function welcomeTemplate(params: {
  namaResto: string;
  subdomain: string;
  trialEndsAt: Date;
}): { subject: string; html: string } {
  const { namaResto, subdomain, trialEndsAt } = params;
  const subject = `Selamat Datang di DapurSajiResto - Trial 7 Hari Aktif!`;

  const content = `
    <h2>Selamat Datang di DapurSajiResto! 🎉</h2>
    <p>Halo <strong>${namaResto}</strong>,</p>
    <p>Selamat! Akun DapurSajiResto Anda sudah aktif dengan masa uji coba <strong>GRATIS 7 hari</strong>. Anda bisa langsung pakai semua fitur tanpa biaya.</p>
    <div class="receipt">
      <div class="receipt-row"><span>Nama Resto</span><strong>${namaResto}</strong></div>
      <div class="receipt-row"><span>URL Dashboard</span><strong>${process.env.APP_PROTOCOL || "https"}://${subdomain}.${process.env.BASE_DOMAIN}</strong></div>
      <div class="receipt-row"><span>Trial Berakhir</span><strong>${formatTanggalID(trialEndsAt)}</strong></div>
    </div>
    <p><strong>Fitur yang bisa Anda pakai:</strong></p>
    <p>• Menu digital + QR code per meja</p>
    <p>• Input pesanan real-time (sinkron HP 1 & HP 2)</p>
    <p>• Kitchen display untuk dapur</p>
    <p>• Generate struk + print Bluetooth</p>
    <p>• Multi-user (owner, kasir, pelayan)</p>
    <p>Setelah trial, langganan hanya <strong>${formatRupiah(PAYMENT_INFO.price)}/bulan</strong> (auto-debit GoPay/OVO/ShopeePay).</p>
    <a href="${process.env.NEXTAUTH_URL}/dashboard" class="btn">Mulai Pakai Sekarang</a>
    <p>Salam,<br><strong>Tim DapurSajiResto</strong></p>
  `;

  return { subject, html: baseTemplate(content, subject) };
}

// ============================================================
// Send email (dengan log ke DB)
// ============================================================
interface SendEmailParams {
  tenantId: string;
  toEmail: string;
  type: EmailType;
  subject: string;
  html: string;
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const { tenantId, toEmail, type, subject, html } = params;

  // Log ke DB (queued)
  const log = await prisma.emailLog.create({
    data: {
      tenantId,
      type,
      toEmail,
      subject,
      status: EmailStatus.QUEUED,
    },
  });

  try {
    if (!resend) {
      // Dev mode: tidak ada API key, simulasi sukses
      console.log(`[EMAIL-DEV] To: ${toEmail} | Subject: ${subject}`);
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: EmailStatus.SENT, sentAt: new Date() },
      });
      return true;
    }

    const { error } = await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject,
      html,
    });

    if (error) {
      console.error("[EMAIL] Send error:", error);
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: EmailStatus.FAILED, error: String(error) },
      });
      return false;
    }

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: EmailStatus.SENT, sentAt: new Date() },
    });
    return true;
  } catch (err) {
    console.error("[EMAIL] Exception:", err);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: EmailStatus.FAILED, error: String(err) },
    });
    return false;
  }
}

// ============================================================
// Helper: kirim email berdasarkan type + data tenant
// ============================================================
export async function sendPaymentSuccessEmail(params: {
  tenantId: string;
  toEmail: string;
  namaResto: string;
  amount: number;
  ewalletType: string;
  periodeAkhir: Date;
  tanggalBayar: Date;
  nomorRef: string;
}) {
  const tpl = paymentSuccessTemplate({
    namaResto: params.namaResto,
    amount: params.amount,
    ewalletType: params.ewalletType,
    periodeAkhir: params.periodeAkhir,
    tanggalBayar: params.tanggalBayar,
    nomorRef: params.nomorRef,
  });
  return sendEmail({
    tenantId: params.tenantId,
    toEmail: params.toEmail,
    type: EmailType.PAYMENT_SUCCESS,
    subject: tpl.subject,
    html: tpl.html,
  });
}

export async function sendPaymentFailedEmail(params: {
  tenantId: string;
  toEmail: string;
  namaResto: string;
  amount: number;
  ewalletType: string;
  retryCount: number;
  nextRetryAt: Date;
  failureReason?: string;
}) {
  const tpl = paymentFailedTemplate({
    namaResto: params.namaResto,
    amount: params.amount,
    ewalletType: params.ewalletType,
    retryCount: params.retryCount,
    nextRetryAt: params.nextRetryAt,
    failureReason: params.failureReason,
  });
  return sendEmail({
    tenantId: params.tenantId,
    toEmail: params.toEmail,
    type: EmailType.PAYMENT_FAILED,
    subject: tpl.subject,
    html: tpl.html,
  });
}

export async function sendSuspendNoticeEmail(params: {
  tenantId: string;
  toEmail: string;
  namaResto: string;
  amount: number;
  lastAttemptDate: Date;
}) {
  const tpl = suspendNoticeTemplate({
    namaResto: params.namaResto,
    amount: params.amount,
    lastAttemptDate: params.lastAttemptDate,
  });
  return sendEmail({
    tenantId: params.tenantId,
    toEmail: params.toEmail,
    type: EmailType.SUSPEND_NOTICE,
    subject: tpl.subject,
    html: tpl.html,
  });
}

export async function sendTrialEndingEmail(params: {
  tenantId: string;
  toEmail: string;
  namaResto: string;
  trialEndsAt: Date;
}) {
  const tpl = trialEndingTemplate({
    namaResto: params.namaResto,
    trialEndsAt: params.trialEndsAt,
  });
  return sendEmail({
    tenantId: params.tenantId,
    toEmail: params.toEmail,
    type: EmailType.TRIAL_ENDING,
    subject: tpl.subject,
    html: tpl.html,
  });
}

export async function sendWelcomeEmail(params: {
  tenantId: string;
  toEmail: string;
  namaResto: string;
  subdomain: string;
  trialEndsAt: Date;
}) {
  const tpl = welcomeTemplate({
    namaResto: params.namaResto,
    subdomain: params.subdomain,
    trialEndsAt: params.trialEndsAt,
  });
  return sendEmail({
    tenantId: params.tenantId,
    toEmail: params.toEmail,
    type: EmailType.WELCOME,
    subject: tpl.subject,
    html: tpl.html,
  });
}
