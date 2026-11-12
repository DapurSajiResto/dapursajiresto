// Helper: hitung pajak, service charge, charges tambahan dari strukSettings
// Dipakai di POS (client) dan API print (server)

export interface StrukCharge {
  nama: string;
  persen: number;
  jumlah: number;
}

export interface StrukSettings {
  pajakAktif: boolean;
  pajakPersen: number;
  pajakNama: string;
  serviceChargeAktif: boolean;
  serviceChargePersen: number;
  serviceChargeNama: string;
  chargesTambahan: { nama: string; persen: number }[];
}

export interface ChargesResult {
  subtotal: number;
  pajak: StrukCharge | null;
  serviceCharge: StrukCharge | null;
  chargesTambahan: StrukCharge[];
  total: number;
}

/**
 * Hitung semua charge dari strukSettings berdasarkan subtotal
 * Pajak & service charge dihitung dari subtotal (bukan berurutan)
 */
export function calculateCharges(
  subtotal: number,
  settings: StrukSettings | null | undefined
): ChargesResult {
  if (!settings) {
    return { subtotal, pajak: null, serviceCharge: null, chargesTambahan: [], total: subtotal };
  }

  // Pajak
  const pajak: StrukCharge | null =
    settings.pajakAktif && settings.pajakPersen > 0
      ? {
          nama: settings.pajakNama || "Pajak",
          persen: settings.pajakPersen,
          jumlah: Math.round((subtotal * settings.pajakPersen) / 100),
        }
      : null;

  // Service charge
  const serviceCharge: StrukCharge | null =
    settings.serviceChargeAktif && settings.serviceChargePersen > 0
      ? {
          nama: settings.serviceChargeNama || "Service Charge",
          persen: settings.serviceChargePersen,
          jumlah: Math.round((subtotal * settings.serviceChargePersen) / 100),
        }
      : null;

  // Charges tambahan
  const chargesTambahan: StrukCharge[] = (settings.chargesTambahan || [])
    .filter((c) => c.persen > 0)
    .map((c) => ({
      nama: c.nama,
      persen: c.persen,
      jumlah: Math.round((subtotal * c.persen) / 100),
    }));

  // Total = subtotal + semua charge
  const total =
    subtotal +
    (pajak?.jumlah || 0) +
    (serviceCharge?.jumlah || 0) +
    chargesTambahan.reduce((sum, c) => sum + c.jumlah, 0);

  return { subtotal, pajak, serviceCharge, chargesTambahan, total };
}
