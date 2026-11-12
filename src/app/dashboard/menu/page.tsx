// Dashboard - Kelola Menu (Owner/Kasir) dengan upload gambar
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardShell } from "@/components/DashboardShell";

interface MenuItem {
  id: string;
  nama: string;
  deskripsi: string | null;
  harga: number;
  gambarUrl: string | null;
  isAvailable: boolean;
  stock: number;
}
interface Category {
  id: string;
  nama: string;
  urutan: number;
  items: MenuItem[];
}

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddItem, setShowAddItem] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/menu");
    const data = await res.json();
    setCategories(data.categories || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addCategory = async (nama: string) => {
    await fetch("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", nama, urutan: categories.length }),
    });
    setShowAddCat(false);
    load();
  };

  const saveItem = async (
    categoryId: string,
    itemData: { nama: string; harga: number; deskripsi?: string; gambarUrl?: string },
    editId?: string
  ) => {
    if (editId) {
      await fetch(`/api/menu/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "item", ...itemData }),
      });
      setEditingItem(null);
    } else {
      await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "item",
          categoryId,
          nama: itemData.nama,
          harga: itemData.harga,
          deskripsi: itemData.deskripsi,
          gambarUrl: itemData.gambarUrl,
          isAvailable: true,
          stock: 0,
        }),
      });
      setShowAddItem(null);
    }
    load();
  };

  const toggleAvailable = async (item: MenuItem) => {
    await fetch(`/api/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "item", isAvailable: !item.isAvailable }),
    });
    load();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Hapus item ini?")) return;
    await fetch(`/api/menu/${id}?type=item`, { method: "DELETE" });
    load();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Hapus kategori ini? Semua item di dalamnya akan dihapus.")) return;
    await fetch(`/api/menu/${id}?type=category`, { method: "DELETE" });
    load();
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="p-8 text-center text-gray-500">Memuat menu...</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto pb-24 md:pb-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kelola Menu</h1>
            <p className="text-sm text-gray-500 mt-1">
              Tambah, edit, atau hapus menu resto Anda
            </p>
          </div>
          <button
            onClick={() => setShowAddCat(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm"
          >
            + Kategori Baru
          </button>
        </div>

        {showAddCat && (
          <AddCategoryForm
            onSubmit={addCategory}
            onCancel={() => setShowAddCat(false)}
          />
        )}

        {categories.length === 0 && !showAddCat && (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed">
            <div className="text-4xl mb-3">🍽️</div>
            <p className="text-gray-500 mb-3">Belum ada menu</p>
            <button
              onClick={() => setShowAddCat(true)}
              className="text-brand-600 font-medium hover:underline"
            >
              + Tambah kategori pertama
            </button>
          </div>
        )}

        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-gray-50 border-b">
                <h2 className="font-semibold text-gray-900">{cat.nama}</h2>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAddItem(cat.id)}
                    className="text-brand-600 text-sm font-medium hover:underline"
                  >
                    + Item
                  </button>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="text-red-500 text-sm hover:underline"
                  >
                    Hapus
                  </button>
                </div>
              </div>

              {showAddItem === cat.id && (
                <ItemForm
                  onSubmit={(d) => saveItem(cat.id, d)}
                  onCancel={() => setShowAddItem(null)}
                />
              )}

              {editingItem && (
                <ItemForm
                  initial={editingItem}
                  onSubmit={(d) => saveItem(cat.id, d, editingItem.id)}
                  onCancel={() => setEditingItem(null)}
                />
              )}

              <div className="divide-y">
                {cat.items.length === 0 && (
                  <div className="px-5 py-4 text-sm text-gray-400">
                    Belum ada item di kategori ini
                  </div>
                )}
                {cat.items.map((item) => (
                  <div key={item.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                    {/* Gambar */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {item.gambarUrl ? (
                        <img
                          src={item.gambarUrl}
                          alt={item.nama}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">
                          🍽️
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 truncate">{item.nama}</span>
                        {!item.isAvailable && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            Tidak tersedia
                          </span>
                        )}
                      </div>
                      {item.deskripsi && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{item.deskripsi}</p>
                      )}
                      <p className="text-brand-700 font-semibold mt-0.5 text-sm">
                        Rp {item.harga.toLocaleString("id-ID")}
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="text-xs px-2.5 py-1 rounded border border-gray-300 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleAvailable(item)}
                        className="text-xs px-2.5 py-1 rounded border border-gray-300 hover:bg-gray-50 hidden sm:block"
                      >
                        {item.isAvailable ? "Sembunyikan" : "Tampilkan"}
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-xs text-red-500 hover:underline px-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}

function AddCategoryForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (nama: string) => void;
  onCancel: () => void;
}) {
  const [nama, setNama] = useState("");
  return (
    <div className="bg-white border rounded-xl p-4 mb-4 shadow-sm">
      <input
        autoFocus
        type="text"
        placeholder="Nama kategori (cth: Makanan, Minuman, Snack)"
        value={nama}
        onChange={(e) => setNama(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && nama.trim()) onSubmit(nama.trim());
        }}
        className="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={() => nama.trim() && onSubmit(nama.trim())}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Simpan
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm border"
        >
          Batal
        </button>
      </div>
    </div>
  );
}

function ItemForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: MenuItem;
  onSubmit: (d: { nama: string; harga: number; deskripsi?: string; gambarUrl?: string }) => void;
  onCancel: () => void;
}) {
  const [nama, setNama] = useState(initial?.nama || "");
  const [harga, setHarga] = useState(initial?.harga.toString() || "");
  const [deskripsi, setDeskripsi] = useState(initial?.deskripsi || "");
  const [gambarUrl, setGambarUrl] = useState(initial?.gambarUrl || "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, type: "menu" }),
        });
        const result = await res.json();
        if (result.url) setGambarUrl(result.url);
      } catch {
        alert("Gagal upload gambar");
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="px-4 sm:px-5 py-4 bg-brand-50 border-b">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Upload gambar */}
        <div className="flex-shrink-0">
          <div
            onClick={() => fileRef.current?.click()}
            className="w-24 h-24 rounded-lg border-2 border-dashed border-brand-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-brand-500 bg-white"
          >
            {gambarUrl ? (
              <img src={gambarUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : uploading ? (
              <span className="text-xs text-gray-400">Uploading...</span>
            ) : (
              <div className="text-center">
                <div className="text-2xl mb-1">📷</div>
                <span className="text-xs text-gray-400">Upload</span>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          {gambarUrl && (
            <button
              onClick={() => setGambarUrl("")}
              className="text-xs text-red-500 mt-1 block mx-auto"
            >
              Hapus Gambar
            </button>
          )}
        </div>

        {/* Form fields */}
        <div className="flex-1 space-y-2">
          <input
            autoFocus
            type="text"
            placeholder="Nama item (cth: Nasi Goreng Spesial)"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Harga (Rp)"
              value={harga}
              onChange={(e) => setHarga(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Deskripsi (opsional)"
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => {
            const h = parseInt(harga, 10);
            if (nama.trim() && !isNaN(h)) {
              onSubmit({
                nama: nama.trim(),
                harga: h,
                deskripsi: deskripsi.trim() || undefined,
                gambarUrl: gambarUrl || undefined,
              });
            }
          }}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {initial ? "Simpan Perubahan" : "Simpan Item"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm border">
          Batal
        </button>
      </div>
    </div>
  );
}
