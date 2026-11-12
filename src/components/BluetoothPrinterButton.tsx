// BluetoothPrinterButton - Web Bluetooth API untuk print struk ke printer thermal
//
// Cara kerja:
// 1. User klik "Print Bluetooth"
// 2. Browser munculkan dialog pilih printer Bluetooth (requestDevice)
// 3. Connect ke GATT characteristic printer
// 4. Kirim ESC/POS bytes (dari buildReceipt) dalam chunk
//
// Kompatibilitas:
// ✅ Chrome Android
// ✅ Chrome / Edge / Opera desktop
// ❌ Safari iOS (limitasi Apple) - user harus pakai tombol "Print PDF" fallback
//
// docs Web Bluetooth:
//   https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API

"use client";

import { useState } from "react";
import {
  buildReceipt,
  chunkBytes,
  PRINTER_SERVICE_UUIDS,
  PRINTER_CHARACTERISTIC_UUID,
  type ReceiptData,
} from "@/lib/escpos";

interface Props {
  receipt: ReceiptData;
  label?: string;
  className?: string;
}

export function BluetoothPrinterButton({
  receipt,
  label = "🖨️ Print Bluetooth",
  className = "",
}: Props) {
  const [status, setStatus] = useState<"idle" | "connecting" | "printing" | "done" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  const isWebBluetoothSupported =
    typeof navigator !== "undefined" && "bluetooth" in navigator;

  const handlePrint = async () => {
    setStatus("connecting");
    setErrorMsg("");

    try {
      if (!isWebBluetoothSupport) {
        throw new Error(
          "Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome Android/Desktop, atau klik Print PDF."
        );
      }

      // 1. Request device - filter service printer thermal umum
      const device = await navigator.bluetooth!.requestDevice({
        filters: [
          { services: [PRINTER_SERVICE_UUIDS[0]] },
          { services: [PRINTER_SERVICE_UUIDS[1]] },
        ],
        optionalServices: PRINTER_SERVICE_UUIDS,
      });

      setStatus("printing");

      // 2. Connect GATT
      const server = await device.gatt?.connect();
      if (!server) throw new Error("Gagal connect ke printer");

      // 3. Cari service yang tersedia
      let characteristic = null;
      for (const svcUuid of PRINTER_SERVICE_UUIDS) {
        try {
          const service = await server.getPrimaryService(svcUuid);
          characteristic = await service.getCharacteristic(
            PRINTER_CHARACTERISTIC_UUID
          );
          break;
        } catch {
          // coba service berikutnya
        }
      }

      if (!characteristic) {
        throw new Error("Printer tidak mendukung write characteristic. Pastikan printer thermal ESC/POS.");
      }

      // 4. Build ESC/POS bytes
      const bytes = buildReceipt(receipt);

      // 5. Kirim dalam chunk (banyak printer batas 180-512 bytes per write)
      const chunks = chunkBytes(bytes, 180);
      for (const chunk of chunks) {
        // writeValueWithResponse lebih reliable daripada withoutResponse
        // Cast ke BufferSource untuk kompatibilitas TS strict
        await characteristic.writeValueWithResponse(chunk as unknown as BufferSource);
        // Delay kecil antar chunk untuk stabilitas
        await new Promise((r) => setTimeout(r, 50));
      }

      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      console.error("[Bluetooth Print] Error:", err);
      const e = err as Error;
      // User cancel dialog = NotFoundError, tidak usah tampilkan error
      if (e.name === "NotFoundError" || e.message?.includes("User cancelled")) {
        setStatus("idle");
        return;
      }
      setErrorMsg(e.message || "Gagal print");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 5000);
    }
  };

  // Wrapper karena TS strict
  const isWebBluetoothSupport = isWebBluetoothSupported;

  if (!isWebBluetoothSupport) {
    return (
      <div className={className}>
        <button
          disabled
          title="Browser tidak mendukung Web Bluetooth. Pakai Chrome Android/Desktop, atau gunakan Print PDF."
          className="bg-gray-300 text-gray-500 px-4 py-2 rounded-lg text-sm cursor-not-allowed"
        >
          🖨️ Bluetooth tidak didukung
        </button>
        <p className="text-xs text-gray-400 mt-1">
          Pakai Chrome Android/Desktop, atau klik Print PDF
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        onClick={handlePrint}
        disabled={status === "connecting" || status === "printing"}
        className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {status === "connecting" && "Memilih printer..."}
        {status === "printing" && "Mencetak..."}
        {status === "done" && "✓ Terkirim"}
        {status === "error" && "⚠ Gagal - klik lagi"}
        {status === "idle" && label}
      </button>
      {errorMsg && (
        <p className="text-xs text-red-600 mt-1 max-w-xs">{errorMsg}</p>
      )}
      {status === "done" && (
        <p className="text-xs text-green-600 mt-1">Struk terkirim ke printer ✓</p>
      )}
    </div>
  );
}

// TypeScript declarations untuk Web Bluetooth (tidak ada di default lib.dom)
declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: {
        filters?: { services: string[] }[];
        optionalServices?: string[];
        acceptAllDevices?: boolean;
      }): Promise<BluetoothDevice>;
    };
  }
  interface BluetoothDevice {
    gatt?: {
      connect(): Promise<BluetoothRemoteGATTServer>;
      disconnect(): void;
    };
  }
  interface BluetoothRemoteGATTServer {
    getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
  }
  interface BluetoothRemoteGATTService {
    getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>;
  }
  interface BluetoothRemoteGATTCharacteristic {
    writeValueWithResponse(data: BufferSource): Promise<void>;
    writeValueWithoutResponse(data: BufferSource): Promise<void>;
  }
}
