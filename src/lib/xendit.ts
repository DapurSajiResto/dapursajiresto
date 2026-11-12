// Xendit Payment Gateway Integration
//
// Fitur:
// - Recurring billing via Xendit (Rp 10.000/bulan)
// - Auto-debit e-wallet: OVO, GoPay, ShopeePay, DANA, LinkAja
// - Support QRIS (semua e-wallet Indonesia)
// - Webhook verification via Xendit Webhook Token
// - Auto-suspend kalau pembayaran gagal
//
// docs:
//   - https://developers.xendit.co
//   - https://developers.xendit.co/payment-methods/ewallets
//   - https://developers.xendit.co/recurring
//
// API key dari env: XENDIT_SECRET_KEY
// Webhook token dari env: XENDIT_WEBHOOK_TOKEN

const SECRET_KEY = process.env.XENDIT_SECRET_KEY || "";
const PUBLIC_KEY = process.env.XENDIT_PUBLIC_KEY || "";
const WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_TOKEN || "";
const IS_PRODUCTION = process.env.XENDIT_IS_PRODUCTION === "true";
const API_BASE = IS_PRODUCTION
  ? "https://api.xendit.co"
  : "https://api.xendit.co"; // Xendit pakai same base, mode ditentukan oleh key

const PRICE = Number(process.env.SUBSCRIPTION_PRICE || 10000);
const CURRENCY = process.env.SUBSCRIPTION_CURRENCY || "IDR";

function authHeader(): string {
  // Xendit pakai Basic Auth: Base64(secretKey + :)
  return "Basic " + Buffer.from(SECRET_KEY + ":").toString("base64");
}

interface XenditError {
  statusCode?: number;
  message?: string;
  body?: unknown;
}

async function xenditFetch(
  path: string,
  options: { method: string; body?: unknown; params?: Record<string, string> } = { method: "GET" }
) {
  let url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  
  // Add query params if provided
  if (options.params) {
    const searchParams = new URLSearchParams(options.params);
    url += `?${searchParams.toString()}`;
  }

  const res = await fetch(url, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader(),
      "api-version": "2024-12-01",
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
    const err: XenditError = {
      statusCode: res.status,
      message: `Xendit API error ${res.status}`,
      body: data,
    };
    console.error("[Xendit] API Error:", JSON.stringify(err));
    throw err;
  }

  return data;
}

// ============================================================
// 1. Buat Payment Method (untuk simpan e-wallet untuk recurring)
//    docs: https://developers.xendit.co/payment-methods
// ============================================================
interface CreatePaymentMethodParams {
  customerId: string;
  ewalletType: "OVO" | "GOPAY" | "SHOPEEPAY" | "DANA" | "LINKAJA";
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  successReturnUrl?: string;
  failureReturnUrl?: string;
}

export async function createPaymentMethod(params: CreatePaymentMethodParams) {
  const {
    customerId,
    ewalletType,
    customerName,
    customerEmail,
    customerPhone,
    successReturnUrl,
    failureReturnUrl,
  } = params;

  const body: Record<string, unknown> = {
    type: "EWALLET",
    reusability: "MULTIPLE_USE", // Bisa dipakai berulang untuk recurring
    customer_id: customerId,
    country: "ID",
    description: `DapurSajiResto Subscription - ${ewalletType}`,
    ewallet: {
      channel_code: ewalletType,
      channel_properties: {
        success_return_url: successReturnUrl || `${process.env.NEXTAUTH_URL}/payment/success`,
        failure_return_url: failureReturnUrl || `${process.env.NEXTAUTH_URL}/payment/failed`,
      },
    },
  };

  // Tambah customer data
  if (customerPhone) {
    (body.ewallet as Record<string, unknown>).channel_properties = {
      ...((body.ewallet as Record<string, unknown>).channel_properties as Record<string, unknown>),
      mobile_number: customerPhone,
    };
  }

  const result = await xenditFetch("/payment_methods", { method: "POST", body });
  return result as XenditPaymentMethod;
}

// ============================================================
// 2. Buat Customer di Xendit (untuk link payment method)
// ============================================================
export async function createCustomer(params: {
  referenceId: string;
  name: string;
  email: string;
  phone?: string;
}) {
  const body = {
    reference_id: params.referenceId,
    type: "INDIVIDUAL",
    individual_detail: {
      names: params.name,
      email: params.email,
      ...(params.phone ? { mobile_number: params.phone } : {}),
    },
    description: "DapurSajiResto Tenant Customer",
  };

  const result = await xenditFetch("/customers", { method: "POST", body });
  return result as { id: string; reference_id: string };
}

// ============================================================
// 3. Buat Payment Session (untuk user authorize payment method)
//    User akan diarahkan ke halaman Xendit untuk authorize e-wallet
// ============================================================
export async function createPaymentSession(params: {
  paymentMethodId: string;
  customerId: string;
  amount: number;
  returnUrl: string;
}) {
  const body = {
    payment_method: {
      id: params.paymentMethodId,
    },
    payment_method_type: "EWALLET",
    currency: CURRENCY,
    amount: params.amount,
    return_url: params.returnUrl,
  };

  const result = await xenditFetch("/payment_sessions", { method: "POST", body });
  return result as { id: string; redirect_url: string };
}

// ============================================================
// 4. Buat Recurring Payment (auto-debit bulanan)
//    docs: https://developers.xendit.co/recurring
// ============================================================
interface CreateRecurringParams {
  paymentMethodId: string;
  customerId: string;
  amount: number;
  description: string;
  interval: number; // 1
  intervalUnit: "MONTH"; // bulanan
  totalRecurrence?: number; // null = unlimited
  startDate?: string; // ISO date, optional
}

export async function createRecurringPayment(params: CreateRecurringParams) {
  const body: Record<string, unknown> = {
    payment_method_id: params.paymentMethodId,
    amount: params.amount,
    currency: CURRENCY,
    description: params.description,
    interval: params.interval,
    interval_unit: params.intervalUnit,
    invoice_duration: 86400, // 24 jam untuk bayar
    should_send_email: true,
    missed_payment_action: "IGNORE", // skip kalau gagal, kita handle suspend sendiri
  };

  if (params.totalRecurrence) {
    body.total_recurrence = params.totalRecurrence;
  }

  if (params.startDate) {
    body.start_date = params.startDate;
  } else {
    body.start_date = new Date().toISOString();
  }

  const result = await xenditFetch("/payment_requests", { method: "POST", body });
  return result as XenditRecurring;
}

// ============================================================
// 5. Buat Invoice sekali (untuk pembayaran pertama / manual)
//    docs: https://developers.xendit.co/invoice
// ============================================================
interface CreateInvoiceParams {
  externalId: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  paymentMethods?: string[]; // restrict to specific methods
}

export async function createInvoice(params: CreateInvoiceParams) {
  const body: Record<string, unknown> = {
    external_id: params.externalId,
    amount: params.amount,
    description: params.description,
    currency: CURRENCY,
    customer: {
      given_names: params.customerName,
      email: params.customerEmail,
      ...(params.customerPhone ? { mobile_number: params.customerPhone } : {}),
    },
    invoice_duration: 86400, // 24 jam
    success_redirect_url: params.successRedirectUrl || `${process.env.NEXTAUTH_URL}/payment/success`,
    failure_redirect_url: params.failureRedirectUrl || `${process.env.NEXTAUTH_URL}/payment/failed`,
    should_send_email: true,
    locale: "id",
  };

  if (params.paymentMethods && params.paymentMethods.length > 0) {
    body.payment_methods = params.paymentMethods;
  }

  const result = await xenditFetch("/v2/invoices", { method: "POST", body });
  return result as XenditInvoice;
}

// ============================================================
// 6. Cek status invoice / payment
// ============================================================
export async function getInvoice(invoiceId: string) {
  const result = await xenditFetch(`/v2/invoices/${invoiceId}`, { method: "GET" });
  return result as XenditInvoice;
}

export async function getPaymentRequest(paymentRequestId: string) {
  const result = await xenditFetch(`/payment_requests/${paymentRequestId}`, { method: "GET" });
  return result as XenditPaymentRequest;
}

// ============================================================
// 7. Verify Webhook (Xendit kirim x-callback-token header)
// ============================================================
export function verifyWebhookToken(callbackToken: string): boolean {
  if (!WEBHOOK_TOKEN) {
    console.warn("[Xendit] XENDIT_WEBHOOK_TOKEN not set in env");
    return false;
  }
  return callbackToken === WEBHOOK_TOKEN;
}

// ============================================================
// 8. Get Payment Method status
// ============================================================
export async function getPaymentMethod(paymentMethodId: string) {
  const result = await xenditFetch(`/payment_methods/${paymentMethodId}`, { method: "GET" });
  return result as XenditPaymentMethod;
}

// ============================================================
// 9. Deactivate Payment Method (untuk cancel subscription)
// ============================================================
export async function deactivatePaymentMethod(paymentMethodId: string) {
  const result = await xenditFetch(`/payment_methods/${paymentMethodId}`, {
    method: "PATCH",
    body: { status: "INACTIVE" },
  });
  return result as XenditPaymentMethod;
}

// ============================================================
// 10. Direct charge (untuk cron retry kalau recurring gagal)
// ============================================================
export async function directCharge(params: {
  paymentMethodId: string;
  amount: number;
  description: string;
  referenceId: string;
}) {
  const body = {
    payment_method_id: params.paymentMethodId,
    amount: params.amount,
    currency: CURRENCY,
    description: params.description,
    reference_id: params.referenceId,
  };

  const result = await xenditFetch("/payment_requests", { method: "POST", body });
  return result as XenditPaymentRequest;
}

// ============================================================
// Type Definitions
// ============================================================
interface XenditPaymentMethod {
  id: string;
  type: string;
  status: "ACTIVE" | "INACTIVE" | "PENDING" | "EXPIRED";
  customer_id: string;
  ewallet?: {
    channel_code: string;
    channel_properties?: Record<string, unknown>;
  };
  created: string;
  updated: string;
}

interface XenditRecurring {
  id: string;
  payment_method_id: string;
  amount: number;
  currency: string;
  status: "ACTIVE" | "STOPPED" | "EXPIRED";
  interval: number;
  interval_unit: string;
  created: string;
  updated: string;
}

interface XenditInvoice {
  id: string;
  external_id: string;
  amount: number;
  status: "PENDING" | "PAID" | "EXPIRED" | "SETTLED";
  invoice_url: string;
  paid_amount?: number;
  paid_at?: string;
  payment_method?: string;
  payment_channel?: string;
  created: string;
  updated: string;
}

interface XenditPaymentRequest {
  id: string;
  payment_method_id: string;
  amount: number;
  currency: string;
  status: "SUCCEEDED" | "PENDING" | "FAILED" | "REQUIRES_ACTION";
  created: string;
  updated: string;
}

// ============================================================
// Konfigurasi e-wallet yang didukung (untuk ditampilkan ke user)
// ============================================================
export const SUPPORTED_EWALLETS = [
  {
    id: "OVO",
    label: "OVO",
    supportsRecurring: true,
    note: "Auto-debit langsung dari saldo OVO (recommended)",
  },
  {
    id: "GOPAY",
    label: "GoPay",
    supportsRecurring: true,
    note: "Auto-debit langsung dari saldo GoPay",
  },
  {
    id: "SHOPEEPAY",
    label: "ShopeePay",
    supportsRecurring: true,
    note: "Auto-debit langsung dari saldo ShopeePay",
  },
  {
    id: "DANA",
    label: "DANA",
    supportsRecurring: true,
    note: "Auto-debit langsung dari saldo DANA",
  },
  {
    id: "LINKAJA",
    label: "LinkAja",
    supportsRecurring: true,
    note: "Auto-debit langsung dari saldo LinkAja",
  },
  {
    id: "QRIS",
    label: "QRIS (semua e-wallet)",
    supportsRecurring: false,
    note: "Bayar via QRIS — cakup semua e-wallet Indonesia",
  },
  {
    id: "BCA",
    label: "Transfer BCA (manual)",
    supportsRecurring: false,
    note: "Anda transfer manual Rp 10.000 tiap bulan ke BCA 5390986868",
  },
] as const;

export const SUBSCRIPTION_AMOUNT = PRICE;
export const IS_XENDIT_PRODUCTION = IS_PRODUCTION;
export const XENDIT_PUBLIC_KEY_VALUE = PUBLIC_KEY;
