// Daftar semua pesanan (history + status)
"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/DashboardShell";

interface Order {
  id: string;
  nomorOrder: string;
  tableNumber: string | null;
  customerName: string | null;
  orderType: string;
  status: string;
  total: number;
  createdAt: string;
  items: { id: string; namaSnapshot: string; qty: number }[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu",
  COOKING: "Memasak",
  READY: "Siap",
  SERVED: "Disajikan",
  PAID: "Dibayar",
  CANCELLED: "Batal",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const url = filter !== "ALL" ? `/api/orders?status=${filter}` : "/api/orders";
    const res = await fetch(url);
    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardShell>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Daftar Pesanan</h1>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="ALL">Semua</option>
            <option value="PENDING">Menunggu</option>
            <option value="COOKING">Memasak</option>
            <option value="READY">Siap</option>
            <option value="SERVED">Disajikan</option>
            <option value="PAID">Dibayar</option>
            <option value="CANCELLED">Batal</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Memuat...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl text-gray-500">
            Belum ada pesanan
          </div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3">No. Order</th>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Meja/Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{o.nomorOrder}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(o.createdAt).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {o.tableNumber ? `Meja ${o.tableNumber}` : o.customerName || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {o.items.map((i) => `${i.qty}x ${i.namaSnapshot}`).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      Rp {o.total.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded bg-gray-100">
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
