// StrukPreview - tampilan struk untuk fallback print via browser
// Render struk sebagai HTML (ukuran 58mm/80mm) yang bisa di-print via window.print()

"use client";

import type { ReceiptData } from "@/lib/escpos";
import { formatRupiah } from "@/lib/escpos";

interface Props {
  receipt: ReceiptData;
  onPrint?: () => void;
}

export function StrukPreview({ receipt, onPrint }: Props) {
  const widthClass = receipt.width === 80 ? "width-80" : "";

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className={`struk-print ${widthClass} mx-auto bg-white`} style={{ width: receipt.width === 80 ? "80mm" : "58mm" }}>
        <div className="text-center mb-2">
          <div className="font-bold text-base">{receipt.namaResto}</div>
          {receipt.alamat && (
            <div className="text-xs text-gray-600">{receipt.alamat}</div>
          )}
          {receipt.phone && (
            <div className="text-xs text-gray-600">Telp: {receipt.phone}</div>
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        <div className="text-xs space-y-0.5">
          <div className="flex justify-between">
            <span>No. Struk</span>
            <span>{receipt.nomorStruk}</span>
          </div>
          {receipt.nomorOrder && (
            <div className="flex justify-between">
              <span>No. Order</span>
              <span>{receipt.nomorOrder}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Tanggal</span>
            <span>{receipt.tanggal}</span>
          </div>
          {receipt.tableNumber && (
            <div className="flex justify-between">
              <span>Meja</span>
              <span>{receipt.tableNumber}</span>
            </div>
          )}
          {receipt.customerName && (
            <div className="flex justify-between">
              <span>Customer</span>
              <span>{receipt.customerName}</span>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        <div className="text-xs space-y-1">
          {receipt.items.map((item, i) => (
            <div key={i}>
              <div>{item.qty}x {item.nama}</div>
              <div className="text-right">{formatRupiah(item.subtotal)}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Subtotal & Charges */}
        <div className="text-xs space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatRupiah(receipt.subtotal)}</span>
          </div>
          {receipt.pajak && receipt.pajak.jumlah > 0 && (
            <div className="flex justify-between">
              <span>{receipt.pajak.nama} {receipt.pajak.persen}%</span>
              <span>{formatRupiah(receipt.pajak.jumlah)}</span>
            </div>
          )}
          {receipt.serviceCharge && receipt.serviceCharge.jumlah > 0 && (
            <div className="flex justify-between">
              <span>{receipt.serviceCharge.nama} {receipt.serviceCharge.persen}%</span>
              <span>{formatRupiah(receipt.serviceCharge.jumlah)}</span>
            </div>
          )}
          {receipt.chargesTambahan?.map((charge, i) => (
            <div key={i} className="flex justify-between">
              <span>{charge.nama} {charge.persen}%</span>
              <span>{formatRupiah(charge.jumlah)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        <div className="text-center font-bold text-base mb-2">
          {formatRupiah(receipt.total)}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {receipt.paymentMethod && (
          <div className="text-xs">
            <div className="flex justify-between">
              <span>Pembayaran</span>
              <span>{receipt.paymentMethod}</span>
            </div>
            {receipt.bayar ? (
              <>
                <div className="flex justify-between">
                  <span>Bayar</span>
                  <span>{formatRupiah(receipt.bayar)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kembalian</span>
                  <span>{formatRupiah(receipt.kembalian || 0)}</span>
                </div>
              </>
            ) : null}
          </div>
        )}

        <div className="text-center text-xs mt-3 mb-2">
          {receipt.footer || "Terima kasih telah berkunjung"}
        </div>
      </div>

      <div className="mt-4 flex gap-2 no-print">
        <button
          onClick={onPrint}
          className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm"
        >
          🖨️ Print via Browser
        </button>
      </div>
    </div>
  );
}
