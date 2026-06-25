"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useUser } from "@/lib/user-context"
import { Loader2, Printer, ArrowLeft } from "lucide-react"

interface SummaryItem {
  tripCount: number
  totalFare: number
  totalCompanyShare: number
  totalPaid: number
  totalRemaining: number
  pendingTripCount: number
}

interface DebtSummary {
  debtCount: number
  totalDebt: number
  totalPaid: number
  totalRemaining: number
}

interface DriverReport {
  driver: {
    id: number
    name: string
    vehicle: string | null
    vehicleType: string | null
    status: string
  }
  deposits: {
    summary: SummaryItem
    unpaid: Array<{
      id: number
      date: string
      origin: string
      destination: string
      fare: number
      companyShare: number
      paidCompanyAmount: number
      status: string
    }>
    recentPaid: Array<{
      id: number
      date: string
      origin: string
      destination: string
      fare: number
      companyShare: number
      paidCompanyAmount: number
      status: string
    }>
  }
  debts: {
    summary: DebtSummary
    list: Array<{
      id: number
      date: string
      dueDate: string | null
      amount: number
      paidAmount: number
      status: string
      notes: string | null
    }>
    payments: Array<{
      id: number
      debt_id: number
      amount: number
      paid_at: string
      notes: string | null
    }>
  }
}

export default function PrintDriverReportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const driverName = searchParams.get("driver")
  const { isAdmin, isAuthenticated } = useUser()
  const [data, setData] = useState<DriverReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    if (!isAdmin) {
      setError("Hanya Admin yang dapat mengakses halaman cetak laporan ini.")
      setLoading(false)
      return
    }
  }, [isAuthenticated, isAdmin, router])

  useEffect(() => {
    if (!driverName || !isAdmin) return

    const fetchData = async () => {
      try {
        setLoading(true)
        const resp = await fetch(`/api/report/driver?name=${encodeURIComponent(driverName)}`)
        if (!resp.ok) {
          throw new Error("Gagal mengambil data laporan driver")
        }
        const reportData = await resp.json()
        setData(reportData)
      } catch (err: any) {
        setError(err.message || "Terjadi kesalahan")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [driverName, isAdmin])

  // Trigger print automatically when data is loaded
  useEffect(() => {
    if (data && !loading && !error) {
      const timer = setTimeout(() => {
        window.print()
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [data, loading, error])

  const formatRupiah = (amount: number) => {
    return "Rp " + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 print:hidden">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
        <p className="text-muted-foreground text-sm">Memuat laporan keuangan driver...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center print:hidden">
        <p className="text-destructive font-semibold mb-2">Error</p>
        <p className="text-muted-foreground text-sm mb-4">{error}</p>
        <button
          onClick={() => router.back()}
          className="px-4 h-10 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          Kembali
        </button>
      </div>
    )
  }

  if (!data) return null

  const { driver, deposits, debts } = data
  const datePrinted = new Date().toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <div className="min-h-screen bg-white text-black p-6 md:p-10 font-sans max-w-4xl mx-auto">
      {/* Print Control Header (Hidden on actual print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-4 mb-6 print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.close()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Tutup Tab
          </button>
          <span className="text-xs text-gray-500">
            Halaman ini dioptimalkan untuk cetak PDF/Kertas.
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold shadow-sm transition-colors"
        >
          <Printer className="h-4 w-4" />
          Cetak Sekarang
        </button>
      </div>

      {/* Main Print Layout */}
      <div className="space-y-8">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b-2 border-gray-900 pb-5">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-gray-900">
              Laporan Keuangan Driver
            </h1>
            <p className="text-sm text-gray-600 mt-1">OkeKirim - Layanan Logistik & Transportasi</p>
          </div>
          <div className="text-right text-xs text-gray-500 space-y-0.5">
            <p>Tanggal Cetak: <span className="font-medium text-gray-800">{datePrinted}</span></p>
            <p>Status Driver: <span className="font-semibold text-green-700 capitalize">{driver.status}</span></p>
          </div>
        </div>

        {/* Driver Profile Summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Nama Driver</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">{driver.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Plat Kendaraan</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">{driver.vehicle || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Tipe Kendaraan</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">{driver.vehicleType || "-"}</p>
          </div>
        </div>

        {/* Financial Recap Cards */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
            Ringkasan Keuangan
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="border border-gray-200 rounded-xl p-4 bg-white">
              <p className="text-[10px] text-gray-500 font-bold uppercase">Total Trip</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{deposits.summary.tripCount} kali</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{deposits.summary.pendingTripCount} nunggak</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 bg-white">
              <p className="text-[10px] text-gray-500 font-bold uppercase">Wajib Setor</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {formatRupiah(deposits.summary.totalCompanyShare)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">Argo: {formatRupiah(deposits.summary.totalFare)}</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 bg-white border-l-orange-500 border-l-2">
              <p className="text-[10px] text-gray-500 font-bold uppercase">Sisa Setoran</p>
              <p className="text-lg font-bold text-orange-600 mt-1">
                {formatRupiah(deposits.summary.totalRemaining)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Masuk: {formatRupiah(deposits.summary.totalPaid)}
              </p>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 bg-white border-l-red-500 border-l-2">
              <p className="text-[10px] text-gray-500 font-bold uppercase">Sisa Kasbon/Hutang</p>
              <p className="text-lg font-bold text-red-600 mt-1">
                {formatRupiah(debts.summary.totalRemaining)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Total: {formatRupiah(debts.summary.totalDebt)}
              </p>
            </div>
          </div>
          
          {/* Total Outstanding Liabilities */}
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex justify-between items-center text-sm">
            <span className="font-bold text-red-800 uppercase tracking-wide text-xs">
              Total Kewajiban Driver (Sisa Setoran + Sisa Kasbon)
            </span>
            <span className="text-xl font-extrabold text-red-700">
              {formatRupiah(deposits.summary.totalRemaining + debts.summary.totalRemaining)}
            </span>
          </div>
        </div>

        {/* Unpaid Trip Deposits Details */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
            Daftar Setoran Trip Tertunda (Nunggak)
          </h2>
          {deposits.unpaid.length === 0 ? (
            <p className="text-sm text-gray-500 italic bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              Tidak ada setoran trip yang tertunda (Semua trip lunas).
            </p>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Rute (Bongkar / Muat)</th>
                    <th className="py-2.5 px-3 text-right">Total Argo</th>
                    <th className="py-2.5 px-3 text-right">Wajib Setor (40%)</th>
                    <th className="py-2.5 px-3 text-right">Sudah Dibayar</th>
                    <th className="py-2.5 px-3 text-right">Sisa Tagihan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deposits.unpaid.map((trip) => (
                    <tr key={trip.id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 whitespace-nowrap">{formatDate(trip.date)}</td>
                      <td className="py-2 px-3 font-medium">
                        {trip.origin} → {trip.destination}
                      </td>
                      <td className="py-2 px-3 text-right">{formatRupiah(trip.fare)}</td>
                      <td className="py-2 px-3 text-right">{formatRupiah(trip.companyShare)}</td>
                      <td className="py-2 px-3 text-right">{formatRupiah(trip.paidCompanyAmount)}</td>
                      <td className="py-2 px-3 text-right font-bold text-red-600">
                        {formatRupiah(Math.max(0, trip.companyShare - trip.paidCompanyAmount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Debt / Kasbon History */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
            Riwayat Kasbon / Hutang
          </h2>
          {debts.list.length === 0 ? (
            <p className="text-sm text-gray-500 italic bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              Tidak ada catatan kasbon/hutang untuk driver ini.
            </p>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Tanggal Pinjam</th>
                    <th className="py-2.5 px-3">Catatan / Keterangan</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Total Pinjaman</th>
                    <th className="py-2.5 px-3 text-right">Sudah Dibayar</th>
                    <th className="py-2.5 px-3 text-right">Sisa Hutang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {debts.list.map((debt) => (
                    <tr key={debt.id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 whitespace-nowrap">{formatDate(debt.date)}</td>
                      <td className="py-2 px-3 text-gray-700">{debt.notes || "-"}</td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                            debt.status === "lunas"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {debt.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">{formatRupiah(debt.amount)}</td>
                      <td className="py-2 px-3 text-right">{formatRupiah(debt.paidAmount)}</td>
                      <td className="py-2 px-3 text-right font-bold text-red-600">
                        {formatRupiah(Math.max(0, debt.amount - debt.paidAmount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Debt Payments Log */}
        {debts.payments.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
              Riwayat Pembayaran Kasbon
            </h2>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Tanggal Bayar</th>
                    <th className="py-2.5 px-3">Kasbon ID</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                    <th className="py-2.5 px-3 text-right">Jumlah Bayar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {debts.payments.map((pmt) => (
                    <tr key={pmt.id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 whitespace-nowrap">{formatDate(pmt.paid_at)}</td>
                      <td className="py-2 px-3 text-gray-500">#{pmt.debt_id}</td>
                      <td className="py-2 px-3 text-gray-700">{pmt.notes || "-"}</td>
                      <td className="py-2 px-3 text-right font-bold text-green-700">
                        {formatRupiah(pmt.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Signature & Verification Footer */}
        <div className="grid grid-cols-2 gap-10 pt-10 text-xs">
          <div className="text-center">
            <p className="text-gray-500">Mengetahui/Menerima,</p>
            <div className="h-16"></div>
            <p className="font-bold border-t border-gray-400 pt-1 inline-block min-w-[150px]">
              {driver.name}
            </p>
            <p className="text-[10px] text-gray-400">Driver</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Dibuat oleh,</p>
            <div className="h-16"></div>
            <p className="font-bold border-t border-gray-400 pt-1 inline-block min-w-[150px]">
              Admin OkeKirim
            </p>
            <p className="text-[10px] text-gray-400">Kasir / Verifikator</p>
          </div>
        </div>
      </div>
    </div>
  )
}
