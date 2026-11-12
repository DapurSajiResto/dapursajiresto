// POS - Input pesanan (pelayan/kasir) - responsive + gambar + pajak
"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { calculateCharges, StrukSettings, StrukCharge } from "@/lib/charges";

interface MenuItem {
  id: string;
  nama: string;
  harga: number;
  gambarUrl: string | null;
  isAvailable: boolean;
}
interface Category {
  id: string;
  nama: string;
  items: MenuItem[];
}
interface CartItem {
  menuItemId: string;
  nama: string;
  harga: number;
  qty: number;
  catatan?: string;
}

export default function PosPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">("DINE_IN");
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<string | null>(null);
  const [strukSettings, setStrukSettings] = useState<StrukSettings | null>(null);
  const [showCartMobile, setShowCartMobile] = useState(false);

  const load = useCallback(async () => {
    const [menuRes, pengRes] = await Promise.all([
      fetch("/api/menu"),
      fetch("/api/pengaturan"),
    ]);
    const menuData = await menuRes.json();
    const pengData = await pengRes.json();
    setCategories(menuData.categories || []);
    if (menuData.categories?.length && !activeCat) {
      setActiveCat(menuData.categories[0].id);
    }
    if (pengData.strukSettings) {
      setStrukSettings(pengData.strukSettings);
    }
  }, [activeCat]);

  useEffect(() => {
    load();
  }, [load]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [
        ...prev,
        { menuItemId: item.id, nama: item.nama, harga: item.harga, qty: 1 },
      ];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItemId === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c
        )
        .filter((c) => c.qty > 0)
    );
  };

  const subtotal = cart.reduce((sum, c) => sum + c.harga * c.qty, 0);
  const charges = calculateCharges(subtotal, strukSettings);
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  const submit = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((c) => ({
            menuItemId: c.menuItemId,
            qty: c.qty,
            catatan: c.catatan,
          })),
          orderType,
          tableNumber: orderType === "DINE_IN" ? tableNumber : undefined,
          customerName: customerName || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastOrder(data.order.nomorOrder);
        setCart([]);
        setTableNumber("");
        setCustomerName("");
        setShowCartMobile(false);
        setTimeout(() => setLastOrder(null), 5000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const currentCat = categories.find((c) => c.id === activeCat);

  return (
    <DashboardShell>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] lg:h-screen">
        {/* Left: Menu grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Category tabs */}
          <div className="bg-white border-b px-3 py-2 flex gap-2 overflow-x-auto no-print sticky top-0 z-10">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
                  activeCat === cat.id
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {cat.nama}
              </button>
            ))}
          </div>

          {/* Menu items grid */}
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3">
            {currentCat?.items
              .filter((i) => i.isAvailable)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="bg-white border rounded-xl overflow-hidden text-left hover:shadow-md hover:border-brand-300 transition flex flex-col"
                >
                  <div className="w-full aspect-square bg-gray-100 overflow-hidden">
                    {item.gambarUrl ? (
                      <img
                        src={item.gambarUrl}
                        alt={item.nama}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">
                        🍽️
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="font-medium text-gray-900 text-xs sm:text-sm mb-0.5 line-clamp-2">
                      {item.nama}
                    </div>
                    <div className="text-brand-600 font-bold text-sm">
                      Rp {item.harga.toLocaleString("id-ID")}
                    </div>
                  </div>
                </button>
              ))}
            {currentCat?.items.filter((i) => i.isAvailable).length === 0 && (
              <div className="col-span-full text-center text-gray-400 py-8">
                Tidak ada item tersedia di kategori ini
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart - desktop sidebar */}
        <div className="hidden lg:flex w-80 bg-white border-l flex-col no-print">
          <CartPanel
            cart={cart}
            orderType={orderType}
            setOrderType={setOrderType}
            tableNumber={tableNumber}
            setTableNumber={setTableNumber}
            customerName={customerName}
            setCustomerName={setCustomerName}
            updateQty={updateQty}
            subtotal={subtotal}
            charges={charges}
            submitting={submitting}
            lastOrder={lastOrder}
            submit={submit}
          />
        </div>

        {/* Mobile: floating cart button */}
        <button
          onClick={() => setShowCartMobile(true)}
          className="lg:hidden fixed bottom-20 right-4 z-30 bg-brand-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
        >
          🛒
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>

        {/* Mobile: cart drawer */}
        {showCartMobile && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setShowCartMobile(false)}
            />
            <div className="relative w-full max-w-sm bg-white flex flex-col ml-auto h-full">
              <div className="flex items-center justify-between p-3 border-b">
                <h2 className="font-bold text-gray-900">Pesanan</h2>
                <button onClick={() => setShowCartMobile(false)} className="text-gray-400 text-xl">
                  ✕
                </button>
              </div>
              <CartPanel
                cart={cart}
                orderType={orderType}
                setOrderType={setOrderType}
                tableNumber={tableNumber}
                setTableNumber={setTableNumber}
                customerName={customerName}
                setCustomerName={setCustomerName}
                updateQty={updateQty}
                subtotal={subtotal}
                charges={charges}
                submitting={submitting}
                lastOrder={lastOrder}
                submit={submit}
                isMobile
              />
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function CartPanel({
  cart,
  orderType,
  setOrderType,
  tableNumber,
  setTableNumber,
  customerName,
  setCustomerName,
  updateQty,
  subtotal,
  charges,
  submitting,
  lastOrder,
  submit,
  isMobile,
}: {
  cart: CartItem[];
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  setOrderType: (t: "DINE_IN" | "TAKEAWAY" | "DELIVERY") => void;
  tableNumber: string;
  setTableNumber: (v: string) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  updateQty: (id: string, delta: number) => void;
  subtotal: number;
  charges: { subtotal: number; pajak: StrukCharge | null; serviceCharge: StrukCharge | null; chargesTambahan: StrukCharge[]; total: number };
  submitting: boolean;
  lastOrder: string | null;
  submit: () => void;
  isMobile?: boolean;
}) {
  return (
    <>
      {!isMobile && (
        <div className="p-4 border-b">
          <h2 className="font-bold text-gray-900">Pesanan</h2>
        </div>
      )}

      <div className="p-3 border-b space-y-2">
        <div className="flex gap-2">
          {(["DINE_IN", "TAKEAWAY", "DELIVERY"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`flex-1 text-xs py-1.5 rounded ${
                orderType === t
                  ? "bg-brand-100 text-brand-700 font-medium"
                  : "bg-gray-50 text-gray-600"
              }`}
            >
              {t === "DINE_IN" ? "Dine-in" : t === "TAKEAWAY" ? "Bawa Pulang" : "Antar"}
            </button>
          ))}
        </div>
        {orderType === "DINE_IN" && (
          <input
            type="text"
            placeholder="No. Meja"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
        )}
        <input
          type="text"
          placeholder="Nama customer (opsional)"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="w-full border rounded px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {cart.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            Pilih item dari menu
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item.menuItemId} className="flex items-center gap-2 text-sm">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{item.nama}</div>
                  <div className="text-xs text-gray-500">
                    Rp {item.harga.toLocaleString("id-ID")} x {item.qty}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(item.menuItemId, -1)}
                    className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-medium">{item.qty}</span>
                  <button
                    onClick={() => updateQty(item.menuItemId, 1)}
                    className="w-7 h-7 rounded bg-brand-100 text-brand-700 flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t p-3 space-y-1">
        {lastOrder && (
          <div className="bg-green-50 text-green-700 text-sm rounded p-2 mb-2 text-center">
            ✓ Pesanan {lastOrder} terkirim ke dapur
          </div>
        )}
        {/* Breakdown harga */}
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>Rp {subtotal.toLocaleString("id-ID")}</span>
        </div>
        {charges.pajak && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>{charges.pajak.nama} {charges.pajak.persen}%</span>
            <span>Rp {charges.pajak.jumlah.toLocaleString("id-ID")}</span>
          </div>
        )}
        {charges.serviceCharge && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>{charges.serviceCharge.nama} {charges.serviceCharge.persen}%</span>
            <span>Rp {charges.serviceCharge.jumlah.toLocaleString("id-ID")}</span>
          </div>
        )}
        {charges.chargesTambahan.map((c, i) => (
          <div key={i} className="flex justify-between text-sm text-gray-600">
            <span>{c.nama} {c.persen}%</span>
            <span>Rp {c.jumlah.toLocaleString("id-ID")}</span>
          </div>
        ))}
        <div className="flex justify-between pt-1 border-t">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="font-bold text-lg text-brand-600">
            Rp {charges.total.toLocaleString("id-ID")}
          </span>
        </div>
        <button
          onClick={submit}
          disabled={cart.length === 0 || submitting}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 mt-2"
        >
          {submitting ? "Mengirim..." : "Kirim Pesanan"}
        </button>
      </div>
    </>
  );
}
