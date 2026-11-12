// Kitchen Display - real-time update pesanan masuk
// Pakai Socket.IO untuk live sync antar HP
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { DashboardShell } from "@/components/DashboardShell";
import { useSocket } from "@/lib/socket-client";

interface OrderItem {
  id: string;
  menuItemId: string;
  namaSnapshot: string;
  qty: number;
  catatan: string | null;
}
interface Order {
  id: string;
  nomorOrder: string;
  tableNumber: string | null;
  customerName: string | null;
  orderType: string;
  status: string;
  total: number;
  catatan: string | null;
  createdAt: string;
  items: OrderItem[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 border-yellow-300",
  COOKING: "bg-blue-100 border-blue-300",
  READY: "bg-green-100 border-green-300",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu",
  COOKING: "Memasak",
  READY: "Siap Saji",
  SERVED: "Disajikan",
  PAID: "Dibayar",
  CANCELLED: "Batal",
};

export default function KitchenPage() {
  const { data: session } = useSession();
  const tenantId = (session?.user as unknown as { tenantId?: string })?.tenantId;
  const { isConnected } = useSocket(tenantId);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/orders?limit=100");
    const data = await res.json();
    // Hanya tampilkan PENDING, COOKING, READY (aktif di dapur)
    const active = (data.orders || []).filter((o: Order) =>
      ["PENDING", "COOKING", "READY"].includes(o.status)
    );
    setOrders(active);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    // Poll fallback tiap 15 detik (jika socket tidak konek)
    const interval = setInterval(() => {
      if (!isConnected) load();
    }, 15000);

    // Real-time listener via window event (socket hook handle via socket.on)
    const handleNewOrder = () => load();
    const handleStatusUpdate = () => load();
    window.addEventListener("order:new", handleNewOrder);
    window.addEventListener("order:status_update", handleStatusUpdate);
    window.addEventListener("order:paid", handleStatusUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("order:new", handleNewOrder);
      window.removeEventListener("order:status_update", handleStatusUpdate);
      window.removeEventListener("order:paid", handleStatusUpdate);
    };
  }, [load, isConnected]);

  const updateStatus = async (orderId: string, status: string) => {
    // Optimistic update
    setOrders((prev) =>
      status === "SERVED" || status === "PAID"
        ? prev.filter((o) => o.id !== orderId)
        : prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <DashboardShell>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dapur</h1>
            <p className="text-sm text-gray-500 mt-1">
              Pesanan masuk real-time
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-gray-400"
              }`}
            />
            <span className="text-gray-600">
              {isConnected ? "Live (sinkron)" : "Polling 15s"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Memuat...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl">
            <p className="text-gray-500">Tidak ada pesanan aktif 🎉</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`border-2 rounded-xl p-4 ${
                  STATUS_COLORS[order.status] || "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-lg text-gray-900">
                      {order.nomorOrder}
                    </div>
                    <div className="text-xs text-gray-600">
                      {order.tableNumber
                        ? `Meja ${order.tableNumber}`
                        : order.customerName || order.orderType}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium text-gray-700">
                      {STATUS_LABELS[order.status]}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTime(order.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="space-y-1 mb-3 bg-white/50 rounded p-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="text-sm">
                      <div className="flex gap-2">
                        <span className="font-bold text-brand-700">
                          {item.qty}x
                        </span>
                        <span className="flex-1">{item.namaSnapshot}</span>
                      </div>
                      {item.catatan && (
                        <div className="text-xs text-gray-600 ml-6 italic">
                          {item.catatan}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {order.catatan && (
                  <div className="text-xs bg-yellow-50 rounded p-2 mb-2">
                    📝 {order.catatan}
                  </div>
                )}

                <div className="flex gap-2">
                  {order.status === "PENDING" && (
                    <button
                      onClick={() => updateStatus(order.id, "COOKING")}
                      className="flex-1 bg-blue-500 text-white text-sm py-2 rounded"
                    >
                      Mulai Masak
                    </button>
                  )}
                  {order.status === "COOKING" && (
                    <button
                      onClick={() => updateStatus(order.id, "READY")}
                      className="flex-1 bg-green-500 text-white text-sm py-2 rounded"
                    >
                      Siap Saji
                    </button>
                  )}
                  {order.status === "READY" && (
                    <button
                      onClick={() => updateStatus(order.id, "SERVED")}
                      className="flex-1 bg-gray-700 text-white text-sm py-2 rounded"
                    >
                      Sudah Disajikan
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
