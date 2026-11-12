// Halaman Struk - pilih order, preview struk, print Bluetooth/PDF
"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { StrukPreview } from "@/components/StrukPreview";
import { BluetoothPrinterButton } from "@/components/BluetoothPrinterButton";
import type { ReceiptData } from "@/lib/escpos";

interface Order {
  id: string;
  nomorOrder: string;
  tableNumber: string | null;
  customerName: string | null;
  status: string;
  total: number;
  createdAt: string;
  transaction?: { nomorStruk: string } | null;
}

export default function StrukPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/orders?limit=100");
    const data = await res.json();
    // Tampilkan yang SERVED atau PAID (siap di-struk)
    const valid = (data.orders || []).filter((o: Order) =>
      ["SERVED", "PAID"].includes(o.status)
    );
    setOrders(valid);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectOrder = async (orderId: string) => {
    setSelectedId(orderId);
    setLoadingReceipt(true);
    const res = await fetch(`/api/print/${orderId}`);
    const data = await res.json();
    setReceipt(data.receipt);
    setLoadingReceipt(false);
  };

  const markPaid = async (orderId: string, paymentMethod: string, bayar: number) => {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID", paymentMethod, bayar }),
    });
    load();
    // Reload receipt
    selectOrder(orderId);
  };

  const printBrowser = () => {
    window.print();
  };

  return (
    <DashboardShell>
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Struk & Pembayaran</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Order list */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-700 text-sm">
                Pesanan Siap Bayar
              </h2>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {orders.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  Tidak ada pesanan siap bayar
                </div>
              ) : (
                orders.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => selectOrder(o.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                      selectedId === o.id ? "bg-brand-50" : ""
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{o.nomorOrder}</span>
                      <span className="text-brand-600 font-semibold">
                        Rp {o.total.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {o.tableNumber ? `Meja ${o.tableNumber}` : o.customerName} ·{" "}
                      {new Date(o.createdAt).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    {o.transaction && (
                      <div className="text-xs text-green-600 mt-1">
                        ✓ {o.transaction.nomorStruk}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: Struk preview + actions */}
          <div className="lg:col-span-2">
            {!selectedId ? (
              <div className="bg-white border rounded-xl p-12 text-center text-gray-400">
                Pilih pesanan di kiri untuk preview struk
              </div>
            ) : loadingReceipt ? (
              <div className="bg-white border rounded-xl p-12 text-center text-gray-400">
                Memuat struk...
              </div>
            ) : receipt ? (
              <div className="bg-white border rounded-xl p-4">
                <StrukPreview receipt={receipt} onPrint={printBrowser} />

                <div className="mt-4 pt-4 border-t flex flex-wrap gap-3 items-center no-print">
                  <BluetoothPrinterButton receipt={receipt} />

                  <div className="flex-1" />

                  {/* Mark as paid */}
                  <PaymentActions
                    orderId={selectedId}
                    total={receipt.total}
                    onPaid={markPaid}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function PaymentActions({
  orderId,
  total,
  onPaid,
}: {
  orderId: string;
  total: number;
  onPaid: (orderId: string, method: string, bayar: number) => void;
}) {
  const [method, setMethod] = useState("CASH");
  const [bayar, setBayar] = useState("");

  return (
    <div className="flex flex-wrap items-end gap-2">
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        className="border rounded px-2 py-2 text-sm"
      >
        <option value="CASH">Tunai</option>
        <option value="QRIS">QRIS</option>
        <option value="EWALLET">E-Wallet</option>
        <option value="CARD">Kartu</option>
      </select>
      {method === "CASH" && (
        <input
          type="number"
          placeholder={`Bayar (total: ${total})`}
          value={bayar}
          onChange={(e) => setBayar(e.target.value)}
          className="border rounded px-2 py-2 text-sm w-32"
        />
      )}
      <button
        onClick={() =>
          onPaid(orderId, method, method === "CASH" ? Number(bayar) || total : total)
        }
        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
      >
        ✓ Tandai Dibayar
      </button>
    </div>
  );
}
