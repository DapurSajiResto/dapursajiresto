// Halaman Langganan - status subscription, setup pembayaran, history
"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/DashboardShell";

interface SubscriptionData {
  tenant: {
    namaResto: string;
    status: string;
    trialEndsAt: string | null;
    suspendedAt: string | null;
  };
  subscription: {
    plan: string;
    harga: number;
    status: string;
    ewalletType: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    retryCount: number;
    nextRetryAt: string | null;
    paymentLogs: {
      id: string;
      amount: number;
      status: string;
      gatewayRef: string | null;
      createdAt: string;
    }[];
  } | null;
  ewalletOptions: { id: string; label: string; note: string }[];
  price: number;
  paymentInfo: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TRIALING: { label: "Masa Trial", color: "bg-blue-100 text-blue-700" },
  ACTIVE: { label: "Aktif", color: "bg-green-100 text-green-700" },
  PAST_DUE: { label: "Pembayaran Tertunggak", color: "bg-yellow-100 text-yellow-700" },
  SUSPENDED: { label: "Di-Suspend", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Dibatalkan", color: "bg-gray-100 text-gray-700" },
};

export default function SubscriptionPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/payment/subscribe");
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setupPayment = async (ewalletType: string) => {
    setSetupLoading(ewalletType);
    try {
      const res = await fetch("/api/payment/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ewalletType }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || "Gagal setup pembayaran");
        return;
      }
      if (d.paymentUrl) {
        setPaymentUrl(d.paymentUrl);
        window.open(d.paymentUrl, "_blank");
      } else {
        alert(
          "Payment order dibuat. Cek email atau buka aplikasi e-wallet Anda untuk bayar Rp 10.000."
        );
      }
      load();
    } finally {
      setSetupLoading(null);
    }
  };

  if (loading || !data) {
    return (
      <DashboardShell>
        <div className="p-8 text-center text-gray-500">Memuat...</div>
      </DashboardShell>
    );
  }

  const sub = data.subscription;
  const statusInfo = sub
    ? STATUS_LABELS[sub.status] || { label: sub.status, color: "bg-gray-100" }
    : null;

  return (
    <DashboardShell>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Langganan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kelola langganan DapurSajiResto Anda - Rp {data.price.toLocaleString("id-ID")}/bulan
          </p>
        </div>

        {/* Status card */}
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Status Langganan</h2>
            {statusInfo && (
              <span className={`text-sm px-3 py-1 rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            )}
          </div>

          {sub && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500 mb-1">Mulai Periode</div>
                <div className="font-medium">
                  {sub.currentPeriodStart
                    ? new Date(sub.currentPeriodStart).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Aktif Sampai</div>
                <div className="font-medium">
                  {sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : data.tenant.trialEndsAt
                    ? `Trial sampai ${new Date(data.tenant.trialEndsAt).toLocaleDateString("id-ID")}`
                    : "-"}
                </div>
              </div>
              {sub.ewalletType && (
                <div>
                  <div className="text-gray-500 mb-1">Metode Pembayaran</div>
                  <div className="font-medium">{sub.ewalletType}</div>
                </div>
              )}
              {sub.status === "PAST_DUE" && (
                <div>
                  <div className="text-gray-500 mb-1">Retry Berikutnya</div>
                  <div className="font-medium text-yellow-700">
                    {sub.nextRetryAt
                      ? new Date(sub.nextRetryAt).toLocaleDateString("id-ID")
                      : "-"}
                    {" "}({sub.retryCount}/3)
                  </div>
                </div>
              )}
            </div>
          )}

          {data.tenant.status === "TRIAL" && data.tenant.trialEndsAt && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              ℹ️ Masa trial berakhir pada{" "}
              <strong>
                {new Date(data.tenant.trialEndsAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </strong>
              . Setup pembayaran sebelum tanggal ini agar akun tetap aktif.
            </div>
          )}
        </div>

        {/* Setup payment */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Setup Pembayaran Auto-Debit</h2>
          <p className="text-sm text-gray-600 mb-4">
            Pilih metode pembayaran. Setelah charge pertama berhasil, sistem akan
            otomatis memotong Rp {data.price.toLocaleString("id-ID")} setiap bulan.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.ewalletOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setupPayment(opt.id)}
                disabled={setupLoading === opt.id}
                className="border rounded-lg p-4 text-left hover:border-brand-500 hover:bg-brand-50 transition disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{opt.label}</span>
                  {setupLoading === opt.id && (
                    <span className="text-xs text-gray-500">Memproses...</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{opt.note}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600 mb-2">Atau transfer manual:</p>
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Bank</span>
                <strong>{data.paymentInfo.bankName}</strong>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">No. Rekening</span>
                <strong className="font-mono">{data.paymentInfo.accountNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Atas Nama</span>
                <strong>{data.paymentInfo.accountName}</strong>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Transfer Rp {data.price.toLocaleString("id-ID")} lalu hubungi kami untuk verifikasi manual.
            </p>
          </div>
        </div>

        {/* History */}
        {sub && sub.paymentLogs.length > 0 && (
          <div className="bg-white border rounded-xl p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Riwayat Pembayaran</h2>
            <div className="divide-y text-sm">
              {sub.paymentLogs.map((log) => (
                <div key={log.id} className="py-2 flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      Rp {log.amount.toLocaleString("id-ID")}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString("id-ID")}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      log.status === "SUCCESS"
                        ? "bg-green-100 text-green-700"
                        : log.status === "FAILED"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
