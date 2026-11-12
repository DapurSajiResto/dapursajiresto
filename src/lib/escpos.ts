// ESC/POS byte generator untuk printer thermal Bluetooth
//
// Spesifikasi ESC/POS:
//   - Printer thermal 58mm (32 char/line) atau 80mm (48 char/line)
//   - Command ESC/POS dikirim sebagai raw bytes via Web Bluetooth
//   - docs: https://escpos.readthedocs.io/
//
// Kompatibel dengan printer umum:
//   - EPSON TM series
//   - Goojprt, Zjiang, Xprinter (umum di Indonesia)
//
// Web Bluetooth: karakteristik service umum:
//   service UUID: 000018f0-0000-1000-8000-00805f9b34fb
//   characteristic write UUID: 00002af1-0000-1000-8000-00805f9b34fb

// ============================================================
// ESC/POS Command constants
// ============================================================
export const ESC = 0x1b;
export const GS = 0x1d;
export const LF = 0x0a;

// Init printer
export function initPrinter(): number[] {
  return [ESC, 0x40];
}

// Align: 0=left, 1=center, 2=right
export function setAlign(align: 0 | 1 | 2): number[] {
  return [ESC, 0x61, align];
}

// Text style
export function setBold(on: boolean): number[] {
  return [ESC, 0x45, on ? 1 : 0];
}

export function setDoubleSize(): number[] {
  return [GS, 0x21, 0x11]; // double width + height
}

export function setNormalSize(): number[] {
  return [GS, 0x21, 0x00];
}

export function setFontSize(width: number, height: number): number[] {
  // width, height: 0-7
  const n = ((width - 1) << 4) | (height - 1);
  return [GS, 0x21, n & 0xff];
}

// Cut paper (partial cut)
export function cutPaper(): number[] {
  return [GS, 0x56, 0x01];
}

// Feed n lines
export function feedLines(n: number): number[] {
  return [ESC, 0x64, n];
}

// ============================================================
// Text encoder (UTF-8 → bytes, support karakter Indonesia)
// ============================================================
function textToBytes(text: string): number[] {
  return Array.from(Buffer.from(text, "utf-8"));
}

// ============================================================
// Build struk receipt
// ============================================================
export interface ReceiptItem {
  nama: string;
  qty: number;
  harga: number; // harga satuan
  subtotal: number;
}

export interface ReceiptCharge {
  nama: string;
  persen: number;
  jumlah: number;
}

export interface ReceiptData {
  namaResto: string;
  alamat?: string;
  phone?: string;
  logoUrl?: string;
  header?: string; // custom header
  footer?: string;
  nomorStruk: string;
  nomorOrder?: string;
  tanggal: string; // formatted
  tableNumber?: string;
  customerName?: string;
  orderType?: string;
  items: ReceiptItem[];
  subtotal: number; // total sebelum pajak/charge
  pajak?: ReceiptCharge;
  serviceCharge?: ReceiptCharge;
  chargesTambahan?: ReceiptCharge[];
  total: number; // total setelah pajak/charge
  paymentMethod?: string;
  bayar?: number;
  kembalian?: number;
  width: 58 | 80;
}

// Format rupiah
export function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

// Wrap text to max width
function wrapText(text: string, maxLen: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxLen) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines.length ? lines : [""];
}

// Pad text to width
function padLine(left: string, right: string, maxLen: number): string {
  const space = maxLen - left.length - right.length;
  if (space <= 0) return left + " " + right;
  return left + " ".repeat(space) + right;
}

export function buildReceipt(data: ReceiptData): Uint8Array {
  const maxLen = data.width === 58 ? 32 : 48;
  const bytes: number[] = [];

  // Init
  bytes.push(...initPrinter());

  // Header resto
  bytes.push(...setAlign(1));
  bytes.push(...setBold(true));
  bytes.push(...setDoubleSize());
  for (const line of wrapText(data.namaResto.toUpperCase(), maxLen)) {
    bytes.push(...textToBytes(line));
    bytes.push(LF);
  }
  bytes.push(...setNormalSize());
  bytes.push(...setBold(false));

  if (data.alamat) {
    for (const line of wrapText(data.alamat, maxLen)) {
      bytes.push(...textToBytes(line));
      bytes.push(LF);
    }
  }
  if (data.phone) {
    bytes.push(...textToBytes(`Telp: ${data.phone}`));
    bytes.push(LF);
  }

  // Separator
  bytes.push(...setAlign(0));
  bytes.push(...textToBytes("-".repeat(maxLen)));
  bytes.push(LF);

  // Info struk
  bytes.push(...textToBytes(padLine("No. Struk", data.nomorStruk, maxLen)));
  bytes.push(LF);
  if (data.nomorOrder) {
    bytes.push(...textToBytes(padLine("No. Order", data.nomorOrder, maxLen)));
    bytes.push(LF);
  }
  bytes.push(...textToBytes(padLine("Tanggal", data.tanggal, maxLen)));
  bytes.push(LF);
  if (data.tableNumber) {
    bytes.push(...textToBytes(padLine("Meja", data.tableNumber, maxLen)));
    bytes.push(LF);
  }
  if (data.customerName) {
    bytes.push(...textToBytes(padLine("Customer", data.customerName, maxLen)));
    bytes.push(LF);
  }
  if (data.orderType) {
    bytes.push(...textToBytes(padLine("Tipe", data.orderType, maxLen)));
    bytes.push(LF);
  }

  // Separator
  bytes.push(...textToBytes("-".repeat(maxLen)));
  bytes.push(LF);

  // Items
  for (const item of data.items) {
    // Line 1: qty x nama
    const namaLine = `${item.qty}x ${item.nama}`;
    for (const line of wrapText(namaLine, maxLen)) {
      bytes.push(...textToBytes(line));
      bytes.push(LF);
    }
    // Line 2: subtotal right aligned
    bytes.push(...setAlign(2));
    bytes.push(...textToBytes(formatRupiah(item.subtotal)));
    bytes.push(LF);
    bytes.push(...setAlign(0));
  }

  // Separator
  bytes.push(...textToBytes("-".repeat(maxLen)));
  bytes.push(LF);

  // Subtotal
  bytes.push(...setAlign(2));
  bytes.push(...textToBytes(padLine("Subtotal", formatRupiah(data.subtotal), maxLen)));
  bytes.push(LF);

  // Pajak
  if (data.pajak && data.pajak.jumlah > 0) {
    const label = `${data.pajak.nama} ${data.pajak.persen}%`;
    bytes.push(...textToBytes(padLine(label, formatRupiah(data.pajak.jumlah), maxLen)));
    bytes.push(LF);
  }

  // Service Charge
  if (data.serviceCharge && data.serviceCharge.jumlah > 0) {
    const label = `${data.serviceCharge.nama} ${data.serviceCharge.persen}%`;
    bytes.push(...textToBytes(padLine(label, formatRupiah(data.serviceCharge.jumlah), maxLen)));
    bytes.push(LF);
  }

  // Charges Tambahan
  if (data.chargesTambahan) {
    for (const charge of data.chargesTambahan) {
      if (charge.jumlah > 0) {
        const label = `${charge.nama} ${charge.persen}%`;
        bytes.push(...textToBytes(padLine(label, formatRupiah(charge.jumlah), maxLen)));
        bytes.push(LF);
      }
    }
  }

  bytes.push(...setAlign(0));

  // Total
  bytes.push(...setBold(true));
  bytes.push(...setDoubleSize());
  bytes.push(...setAlign(1));
  bytes.push(...textToBytes(formatRupiah(data.total)));
  bytes.push(LF);
  bytes.push(...setNormalSize());
  bytes.push(...setAlign(0));
  bytes.push(...setBold(false));

  bytes.push(...textToBytes("-".repeat(maxLen)));
  bytes.push(LF);

  // Payment method
  if (data.paymentMethod) {
    bytes.push(...textToBytes(padLine("Pembayaran", data.paymentMethod, maxLen)));
    bytes.push(LF);
  }
  if (data.bayar && data.bayar > 0) {
    bytes.push(...textToBytes(padLine("Bayar", formatRupiah(data.bayar), maxLen)));
    bytes.push(LF);
    if (data.kembalian !== undefined) {
      bytes.push(...textToBytes(padLine("Kembalian", formatRupiah(data.kembalian), maxLen)));
      bytes.push(LF);
    }
  }

  // Footer
  bytes.push(...feedLines(1));
  bytes.push(...setAlign(1));
  const footerText = data.footer || "Terima kasih telah berkunjung";
  for (const line of wrapText(footerText, maxLen)) {
    bytes.push(...textToBytes(line));
    bytes.push(LF);
  }
  bytes.push(...feedLines(2));

  // Cut
  bytes.push(...cutPaper());

  return new Uint8Array(bytes);
}

// ============================================================
// Web Bluetooth: service & characteristic UUIDs umum printer thermal
// ============================================================
export const PRINTER_SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb", // umum: Goojprt, Xprinter, Zjiang
  "00001101-0000-1000-8000-00805f9b34fb", // SPP fallback
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // beberapa model printer
];

export const PRINTER_CHARACTERISTIC_UUID = "00002af1-0000-1000-8000-00805f9b34fb";

// Chunk data untuk BLE (max 20 bytes per write di banyak printer)
export function chunkBytes(data: Uint8Array, chunkSize = 180): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}
