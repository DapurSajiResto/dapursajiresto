// Dashboard - Pengaturan Resto (logo, struk, pajak, service charge)
"use client";

import { useState, useEffect, useRef } from "react";
import { DashboardShell } from "@/components/DashboardShell";

interface StrukSettings {
  pajakAktif: boolean;
  pajakPersen: number;
  pajakNama: string;
  serviceChargeAktif: boolean;
  serviceChargePersen: number;
  serviceChargeNama: string;
  chargesTambahan: { nama: string; persen: number }[];
}

interface PengaturanData {
  namaResto: string;
  alamat: string | null;
  phone: string | null;
  logoUrl: string | null;
  strukHeader: string | null;
  strukFooter: string | null;
  strukWidth: number;
  strukSettings: StrukSettings;
}

export default function PengaturanPage() {
  const [data, setData] = useState<PengaturanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/pengaturan")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, type: "logo" }),
        });
        const result = await res.json();
        if (result.url) {
          setData((prev) => (prev ? { ...prev, logoUrl: result.url } : prev));
        }
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setUploadingLogo(false);
      alert("Gagal upload logo");
    }
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/pengaturan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Gagal menyimpan pengaturan");
    }
    setSaving(false);
  };

  const updateSettings = (partial: Partial<StrukSettings>) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            strukSettings: { ...prev.strukSettings, ...partial },
          }
        : prev
    );
  };

  const addCharge = () => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            strukSettings: {
              ...prev.strukSettings,
              chargesTambahan: [
                ...prev.strukSettings.chargesTambahan,
                { nama: "", persen: 0 },
              ],
            },
          }
        : prev
    );
  };

  const updateCharge = (index: number, field: "nama" | "persen", value: string | number) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            strukSettings: {
              ...prev.strukSettings,
              chargesTambahan: prev.strukSettings.chargesTambahan.map((c, i) =>
                i === index ? { ...c, [field]: value } : c
              ),
            },
          }
        : prev
    );
  };

  const removeCharge = (index: number) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            strukSettings: {
              ...prev.strukSettings,
              chargesTambahan: prev.strukSettings.chargesTambahan.filter((_, i) => i !== index),
            },
          }
        : prev
    );
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="p-8 text-center text-gray-500">Memuat pengaturan...</div>
      </DashboardShell>
    );
  }

  if (!data) {
    return (
      <DashboardShell>
        <div className="p-8 text-center text-red-500">Gagal memuat pengaturan</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="px-4 sm:px-6 py-6 max-w-3xl mx-auto pb-24 md:pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Pengaturan Resto</h1>
          <p className="text-sm text-gray-500 mt-1">
            Atur logo resto, informasi, dan pengaturan struk
          </p>
        </div>

        {/* Logo Resto */}
        <Section title="Logo Resto" desc="Logo akan tampil di struk dan halaman menu publik">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
              {data.logoUrl ? (
                <img src={data.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400 text-xs text-center px-2">Belum ada logo</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {uploadingLogo ? "Uploading..." : "Upload Logo"}
              </button>
              {data.logoUrl && (
                <button
                  onClick={() => setData({ ...data, logoUrl: null })}
                  className="text-red-500 text-sm hover:underline"
                >
                  Hapus Logo
                </button>
              )}
              <p className="text-xs text-gray-400">Maksimal 2MB. Format: JPG, PNG, WebP</p>
            </div>
          </div>
        </Section>

        {/* Info Resto */}
        <Section title="Informasi Resto" desc="Data ini tampil di struk">
          <div className="space-y-3">
            <Field label="Nama Resto">
              <input
                type="text"
                value={data.namaResto}
                onChange={(e) => setData({ ...data, namaResto: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Alamat">
              <textarea
                value={data.alamat || ""}
                onChange={(e) => setData({ ...data, alamat: e.target.value })}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="No. Telepon">
              <input
                type="text"
                value={data.phone || ""}
                onChange={(e) => setData({ ...data, phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </Section>

        {/* Pengaturan Struk */}
        <Section title="Pengaturan Struk" desc="Atur tampilan & ukuran struk">
          <div className="space-y-3">
            <Field label="Lebar Struk">
              <select
                value={data.strukWidth}
                onChange={(e) => setData({ ...data, strukWidth: Number(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value={58}>58mm (printer kecil)</option>
                <option value={80}>80mm (printer standar)</option>
              </select>
            </Field>
            <Field label="Header Struk (teks atas)">
              <input
                type="text"
                value={data.strukHeader || ""}
                onChange={(e) => setData({ ...data, strukHeader: e.target.value })}
                placeholder="Terima kasih telah berkunjung"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Footer Struk (teks bawah, opsional)">
              <input
                type="text"
                value={data.strukFooter || ""}
                onChange={(e) => setData({ ...data, strukFooter: e.target.value })}
                placeholder="Selamat menikmati"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </Section>

        {/* Pajak & Service Charge */}
        <Section
          title="Pajak & Biaya Tambahan"
          desc="Atur pajak, service charge, dan biaya lain yang otomatis dihitung di struk"
        >
          <div className="space-y-4">
            {/* Pajak */}
            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <input
                type="checkbox"
                checked={data.strukSettings.pajakAktif}
                onChange={(e) => updateSettings({ pajakAktif: e.target.checked })}
                className="mt-1 w-5 h-5 accent-brand-600"
              />
              <div className="flex-1">
                <label className="font-medium text-sm text-gray-900">Pajak Restoran</label>
                <p className="text-xs text-gray-500 mb-2">
                  Pajak lokal restoran, biasanya 10%
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={data.strukSettings.pajakNama}
                    onChange={(e) => updateSettings({ pajakNama: e.target.value })}
                    placeholder="Nama (cth: Pajak)"
                    className="border rounded-lg px-3 py-1.5 text-sm w-32"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={data.strukSettings.pajakPersen}
                      onChange={(e) => updateSettings({ pajakPersen: Number(e.target.value) })}
                      className="border rounded-lg px-3 py-1.5 text-sm w-20"
                    />
                    <span className="text-gray-500 text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Service Charge */}
            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <input
                type="checkbox"
                checked={data.strukSettings.serviceChargeAktif}
                onChange={(e) => updateSettings({ serviceChargeAktif: e.target.checked })}
                className="mt-1 w-5 h-5 accent-brand-600"
              />
              <div className="flex-1">
                <label className="font-medium text-sm text-gray-900">Service Charge</label>
                <p className="text-xs text-gray-500 mb-2">
                  Biaya layanan, biasanya 5-11%
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={data.strukSettings.serviceChargeNama}
                    onChange={(e) => updateSettings({ serviceChargeNama: e.target.value })}
                    placeholder="Nama (cth: Service Charge)"
                    className="border rounded-lg px-3 py-1.5 text-sm w-32"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={data.strukSettings.serviceChargePersen}
                      onChange={(e) => updateSettings({ serviceChargePersen: Number(e.target.value) })}
                      className="border rounded-lg px-3 py-1.5 text-sm w-20"
                    />
                    <span className="text-gray-500 text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charges Tambahan */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-medium text-sm text-gray-900">Biaya Lain (Opsional)</label>
                <button
                  onClick={addCharge}
                  className="text-brand-600 text-sm font-medium hover:underline"
                >
                  + Tambah Biaya
                </button>
              </div>
              {data.strukSettings.chargesTambahan.length === 0 && (
                <p className="text-xs text-gray-400 italic">
                  Belum ada biaya tambahan. Klik "Tambah Biaya" untuk menambah.
                </p>
              )}
              <div className="space-y-2">
                {data.strukSettings.chargesTambahan.map((charge, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={charge.nama}
                      onChange={(e) => updateCharge(i, "nama", e.target.value)}
                      placeholder="Nama biaya (cth: Biaya Pelayan)"
                      className="border rounded-lg px-3 py-1.5 text-sm flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={charge.persen}
                        onChange={(e) => updateCharge(i, "persen", Number(e.target.value))}
                        className="border rounded-lg px-3 py-1.5 text-sm w-20"
                      />
                      <span className="text-gray-500 text-sm">%</span>
                    </div>
                    <button
                      onClick={() => removeCharge(i)}
                      className="text-red-500 text-sm px-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Save Button */}
        <div className="sticky bottom-16 md:bottom-0 mt-6 flex items-center gap-3 bg-white pt-4 pb-2 border-t">
          <button
            onClick={save}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
          {saved && (
            <span className="text-green-600 text-sm font-medium">✓ Tersimpan</span>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border p-4 sm:p-5 mb-4 shadow-sm">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {desc && <p className="text-xs text-gray-500 mt-0.5 mb-3">{desc}</p>}
      {!desc && <div className="mb-3" />}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
