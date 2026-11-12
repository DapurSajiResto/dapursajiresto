export default function SuspendedPage() {
  const bankName = process.env.PAYMENT_BANK_NAME || "BCA";
  const accountNumber = process.env.PAYMENT_ACCOUNT_NUMBER || "5390986868";
  const accountName =
    process.env.PAYMENT_ACCOUNT_NAME || "HSRA HIDUP SEJAHTERA CV";
  const price = Number(process.env.SUBSCRIPTION_PRICE || 10000);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Akun Di-Suspend
        </h1>
        <p className="text-gray-600 mb-6">
          Akses dashboard resto Anda dihentikan karena pembayaran langganan
          gagal setelah 3x percobaan.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left mb-6">
          <p className="font-semibold text-amber-800 mb-2">
            Cara mengaktifkan kembali:
          </p>
          <p className="text-sm text-amber-700 mb-3">
            Transfer tagihan tertunggak ke:
          </p>
          <div className="bg-white rounded p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Bank</span>
              <strong>{bankName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">No. Rekening</span>
              <strong className="font-mono">{accountNumber}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Atas Nama</span>
              <strong>{accountName}</strong>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-gray-500">Jumlah</span>
              <strong className="text-brand-600">
                Rp {price.toLocaleString("id-ID")}
              </strong>
            </div>
          </div>
          <p className="text-xs text-amber-600 mt-3">
            Setelah transfer, login & upload bukti di menu Langganan. Akun
            aktif kembali dalam 1x24 jam.
          </p>
        </div>

        <a
          href="/login"
          className="inline-block bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-2 rounded-lg"
        >
          Kembali ke Login
        </a>
      </div>
    </div>
  );
}
