"use client"

import { formatCurrency } from "@/lib/utils/currency"
import { Button } from "@/components/ui/button"

interface SuccessPageProps {
  driverName: string
  amount: number
  route: string
  batchCount?: number
  onBack: () => void
}

export function SuccessPage({
  driverName,
  amount,
  route,
  batchCount,
  onBack,
}: SuccessPageProps) {
  const isBatch = batchCount !== undefined && batchCount > 1

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-10">
      {/* Checkmark icon with zoom-in animation */}
      <div className="animate-zoom-in mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <svg
          className="h-10 w-10 text-green-600 dark:text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      {/* Success message */}
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        Setoran Berhasil!
      </h2>

      {/* Deposit details */}
      <div className="mb-8 w-full max-w-sm space-y-3 rounded-xl bg-card p-5 text-card-foreground shadow-sm border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Driver</span>
          <span className="text-sm font-medium">{driverName}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {isBatch ? "Total Nominal" : "Jumlah"}
          </span>
          <span className="text-sm font-semibold text-primary">
            Rp {formatCurrency(amount)}
          </span>
        </div>

        {isBatch && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Jumlah Orderan</span>
            <span className="text-sm font-medium">{batchCount} orderan</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Rute</span>
          <span className="text-sm font-medium text-right max-w-[60%]">
            {route}
          </span>
        </div>
      </div>

      {/* Back button */}
      <Button
        onClick={onBack}
        variant="default"
        size="lg"
        className="w-full max-w-sm"
      >
        Kembali ke Daftar
      </Button>
    </div>
  )
}
