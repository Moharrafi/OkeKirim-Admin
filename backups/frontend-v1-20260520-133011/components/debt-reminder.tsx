"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/lib/user-context"
import { AlertTriangle, X, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function DebtReminder() {
  const router = useRouter()
  const { isDriver, user, isAuthenticated } = useUser()
  const [show, setShow] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || dismissed || !isDriver) return

    // Only show for drivers, not admin
    const checkPending = async () => {
      try {
        const params = new URLSearchParams({ filter: "pending" })
        if (user.name) {
          params.set("driver", user.name)
        }
        const res = await fetch(`/api/tarikan?${params.toString()}`)
        const data = await res.json()
        const schedules = data.schedules || []

        if (schedules.length > 0) {
          const total = schedules.reduce((sum: number, s: { companyShare: number; paidCompanyAmount: number }) => {
            return sum + ((s.companyShare || 0) - (s.paidCompanyAmount || 0))
          }, 0)
          setPendingCount(schedules.length)
          setPendingTotal(total)
          
          setTimeout(() => setShow(true), 1500)
        }
      } catch {
        // Ignore errors
      }
    }

    checkPending()
  }, [isAuthenticated, isDriver, user.name, dismissed])

  const handleDismiss = () => {
    setShow(false)
    setDismissed(true)
  }

  const handleAction = () => {
    setShow(false)
    setDismissed(true)
    router.push("/deposit?tab=setoran")
  }

  if (!show || pendingCount === 0) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-20">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px]" onClick={handleDismiss} />
      <div className="relative w-full max-w-sm animate-in slide-in-from-top-4 duration-300">
        <div className="bg-card border border-warning/30 rounded-2xl p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-warning/10 shrink-0">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Kamu punya {pendingCount} orderan belum disetor
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total: Rp {pendingTotal.toLocaleString("id-ID")}
              </p>
              <Button
                size="sm"
                className="mt-3 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-semibold px-4"
                onClick={handleAction}
              >
                Setor Sekarang
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-full hover:bg-secondary shrink-0"
              aria-label="Tutup"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
