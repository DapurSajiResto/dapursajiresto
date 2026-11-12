"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    namaResto: "",
    subdomain: "",
    ownerName: "",
    email: "",
    phone: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal daftar");
        return;
      }

      // Redirect ke login
      router.push("/login?registered=1");
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-orange-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-brand-600">DapurSajiResto</div>
          <p className="text-gray-500 text-sm mt-1">
            Daftar restoran baru - Gratis trial 7 hari
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Restoran
            </label>
            <input
              required
              type="text"
              value={form.namaResto}
              onChange={(e) => setForm({ ...form, namaResto: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Warung Makan Bahagia"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subdomain (untuk URL resto Anda)
            </label>
            <div className="flex items-center border rounded-lg overflow-hidden">
              <input
                required
                type="text"
                value={form.subdomain}
                onChange={(e) =>
                  setForm({
                    ...form,
                    subdomain: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, ""),
                  })
                }
                className="flex-1 px-3 py-2 outline-none"
                placeholder="warungbahagia"
              />
              <span className="bg-gray-50 px-3 py-2 text-gray-500 text-sm border-l">
                .{process.env.BASE_DOMAIN?.split(":")[0] || "namadomain.com"}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Hanya huruf kecil & angka, tanpa spasi
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Pemilik
            </label>
            <input
              required
              type="text"
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              No. HP
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              required
              type="password"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            {loading ? "Mendaftarkan..." : "Daftar Sekarang"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-brand-600 font-medium">
            Masuk
          </Link>
        </p>

        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-xs text-gray-400">
            Setelah trial 7 hari, langganan hanya Rp 10.000/bulan
          </p>
        </div>
      </div>
    </div>
  );
}
