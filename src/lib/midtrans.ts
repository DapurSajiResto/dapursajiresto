// Midtrans Payment Gateway Integration
//
// Fitur:
// - Recurring billing via Midtrans Subscription API
// - Charge otomatis tiap bulan (Rp 10.000)
// - Support e-wallet: OVO, GoPay, ShopeePay (via Gopay/GFI/Qris)
// - Webhook signature verification
//
// docs:
//   - https://docs.midtrans.com
//   - https://docs.midtrans.com/en/core-api/subscription
//   - https://docs.midtrans.com/en/core-api/credit-card-subscription
//
// Catatan PENTING tentang auto-debit e-wallet di Midtrans:
//   - GoPay: support subscription (auto-debit) via Gopay Tokenization
//   - OVO/ShopeePay/DANA: tersedia via Gopay Account / Direct Debit / QRIS
//     (fitur recurring bervariasi, sebagian perlu approval merchant)
//   - Untuk coverage terbaik, kami juga sediakan QRIS recurring (akses ke semua e-wallet)
//   - API key dari env: MIDTRANS_SERVER_KEY
//
// Semua request pakai Basic Auth: Base64(serverKey + :)

const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || "";
const API_BASE =
  process.env.MIDTRANS_API_BASE_URL || "https://api.sandbox.midtrans.com";
const IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === "true";
const CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || "";

const PRICE = Number(process.env.SUBSCRIPTION_PRICE || 10000);
const CURRENCY = process.env.SUBSCRIPTION_CURRENCY || "IDR";

function authHeader(): string {
  return "Basic " + Buffer.from(SERVER_KEY + ":").toString("base64");
}

interface MidtransError {
  statusCode?: number;
  message?: string;
  body?: unknown;
}

async function midtransFetch(
  path: string,
  options: { method: string; body?: unknown } = { method: "GET" }
) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader(),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data: unknown = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err: MidtransError = {
      statusCode: res.status,
      message: `Midtrans API error ${res.status}`,
      body: data,
    };
    throw err;
  }

  return data;
}

// ============================================================
// 1. Buat transaksi charge sekali (untuk simpan payment method)
// ============================================================
interface ChargeParams {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  paymentType: "gopay" | "qris" | "shopeepay" | "ovo" | "bank_transfer";
  // Untuk gopay: enable payment method tokenization supaya bisa recurring
  savePaymentMethod?: boolean;
}

export async function createCharge(params: ChargeParams) {
  const {
    orderId,
    grossAmount,
    customerName,
    customerEmail,
    customerPhone,
    paymentType,
    savePaymentMethod = true,
  } = params;

  const body: Record<string, unknown> = {
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount,
    },
    customer_details: {
      first_name: customerName,
      email: customerEmail,
      ...(customerPhone ? { phone: customerPhone } : {}),
    },
    item_details: [
      {
        id: "subscription-basic",
        name: "DapurSajiResto Subscription - Basic (Monthly)",
        price: grossAmount,
        quantity: 1,
      },
    ],
  };

  // Konfigurasi per payment type
  switch (paymentType) {
    case "gopay":
      body.payment_type = "gopay";
      if (savePaymentMethod) {
        // Enable GoPay tokenization untuk recurring
        body.gopay = {
          enable_callback: true,
          callback_url: `${process.env.NEXTAUTH_URL}/api/payment/gopay-callback`,
        };
      }
      break;
    case "qris":
      body.payment_type = "qris";
      body.qris = {
        acquirer: "gopay",
      };
      break;
    case "shopeepay":
      body.payment_type = "shopeepay";
      body.shopeepay = {
        callback_url: `${process.env.NEXTAUTH_URL}/api/payment/ewallet-callback`,
      };
      break;
    case "ovo":
      // OVO via Direct Debit / Gopay Account
      body.payment_type = "gopay";
      body.gopay = {
        enable_callback: true,
        callback_url: `${process.env.NEXTAUTH_URL}/api/payment/ewallet-callback`,
      };
      break;
    case "bank_transfer":
      body.payment_type = "bank_transfer";
      body.bank_transfer = {
        bank: "bca",
      };
      break;
  }

  // Metadata
  body.metadata = {
    payment_type_requested: paymentType,
    save_payment_method: savePaymentMethod,
    is_subscription_setup: savePaymentMethod,
  };

  return midtransFetch("/v2/charge", { method: "POST", body });
}

// ============================================================
// 2. Dapatkan payment token dari transaksi (untuk recurring)
// ============================================================
export async function getPaymentToken(orderId: string) {
  // Ambil status transaksi
  return midtransFetch(`/v2/${orderId}/status`, { method: "GET" });
}

// ============================================================
// 3. Create Subscription (recurring) - Midtrans Subscription API
//    docs: https://docs.midtrans.com/en/core-api/subscription
// ============================================================
interface CreateSubscriptionParams {
  name: string;
  amount: number;
  currency?: string;
  paymentType: "gopay" | "credit_card";
  token?: string; // payment token dari charge pertama
  schedule: {
    interval: number; // 1
    intervalUnit: "month"; // bulanan
    startImmediate?: boolean;
    maxInterval?: number;
  };
  metadata?: Record<string, unknown>;
}

export async function createSubscription(params: CreateSubscriptionParams) {
  const body: Record<string, unknown> = {
    name: params.name,
    amount: params.amount,
    currency: params.currency || CURRENCY,
    payment_type: params.paymentType,
    schedule: params.schedule,
  };

  if (params.token) {
    body.token = params.token;
  }

  if (params.metadata) {
    body.metadata = params.metadata;
  }

  return midtransFetch("/v1/subscriptions", { method: "POST", body });
}

// ============================================================
// 4. Get subscription status
// ============================================================
export async function getSubscription(subscriptionId: string) {
  return midtransFetch(`/v1/subscriptions/${subscriptionId}`, {
    method: "GET",
  });
}

// ============================================================
// 5. Enable / Disable / Pause subscription
// ============================================================
export async function enableSubscription(subscriptionId: string) {
  return midtransFetch(`/v1/subscriptions/${subscriptionId}/enable`, {
    method: "POST",
  });
}

export async function disableSubscription(subscriptionId: string) {
  return midtransFetch(`/v1/subscriptions/${subscriptionId}/disable`, {
    method: "POST",
  });
}

// ============================================================
// 6. Verify webhook signature (untuk webhook handler)
//    Midtrans kirim signature_key = SHA512(order_id + status_code + gross_amount + server_key)
// ============================================================
import { createHash } from "crypto";

export function verifyWebhookSignature(body: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}): boolean {
  const { order_id, status_code, gross_amount, signature_key } = body;
  const raw = `${order_id}${status_code}${gross_amount}${SERVER_KEY}`;
  const expected = createHash("sha512").update(raw).digest("hex");
  // Gunakan timing-safe compare
  if (expected.length !== signature_key.length) return false;
  return expected === signature_key;
}

// ============================================================
// 7. Charge manual (untuk cron retry bila subscription API gagal)
// ============================================================
export async function directCharge(params: {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  paymentType: "gopay" | "qris";
  savedToken?: string;
}) {
  return createCharge({
    orderId: params.orderId,
    grossAmount: params.grossAmount,
    customerName: params.customerName,
    customerEmail: params.customerEmail,
    paymentType: params.paymentType,
    savePaymentMethod: false,
  });
}

// ============================================================
// Konfigurasi e-wallet yang didukung (untuk ditampilkan ke user)
// ============================================================
export const SUPPORTED_EWALLETS = [
  {
    id: "gopay",
    label: "GoPay",
    supportsRecurring: true,
    note: "Auto-debit langsung dari saldo GoPay (recommended)",
  },
  {
    id: "ovo",
    label: "OVO",
    supportsRecurring: true,
    note: "Via GoPay account / Direct Debit",
  },
  {
    id: "shopeepay",
    label: "ShopeePay",
    supportsRecurring: true,
    note: "Via GoPay account / QRIS recurring",
  },
  {
    id: "qris",
    label: "QRIS (semua e-wallet)",
    supportsRecurring: true,
    note: "Cakup semua e-wallet Indonesia via QRIS",
  },
  {
    id: "bank_transfer",
    label: "Transfer BCA (manual)",
    supportsRecurring: false,
    note: "Anda transfer manual Rp 10.000 tiap bulan",
  },
] as const;

export const SUBSCRIPTION_AMOUNT = PRICE;
export const IS_MIDTRANS_PRODUCTION = IS_PRODUCTION;
export const MIDTRANS_CLIENT_KEY_PUBLIC = CLIENT_KEY;
