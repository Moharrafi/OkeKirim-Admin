"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import {
  Wallet,
  Users,
  Car,
  TrendingUp,
  Wrench,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Smartphone,
  Banknote,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useUser } from "@/lib/user-context"
import dynamic from "next/dynamic"
import { SkeletonDashboard } from "@/components/skeleton-dashboard"

// Lazy load chart components - only loaded when visible
const DashboardCharts = dynamic(() => import("@/components/dashboard-charts"), {
  ssr: false,
  loading: () => (
    <div className="h-48 flex items-center justify-center">
      <div className="animate-pulse bg-muted rounded-xl w-full h-full" />
    </div>
  ),
})

interface DashboardData {
  monthlyCompanyShare: number
  monthlyDriverShare: number
  monthlyFare: number
  monthlyCount: number
  lastMonthCompanyShare: number
  lastMonthDriverShare: number
  lastMonthFare: number
  pendingTotal: number
  pendingCount: number
  todayTotal: number
  todayCount: number
  activeDrivers: number
  recentTransactions: Array<{
    id: number
    driver: string
    origin: string
    destination: string
    fare: number
    companyShare: number
    status: string
    orderType: string
    date: string
    driverVehicle?: string
    vehicle?: string
  }>
  monthlyChart: Array<{ month: number; total: number }>
  driverIncome: Array<{ driver: string; total: number }>
  orderTypeBreakdown: Array<{ type: string; total: number; count: number }>
}

function formatRupiah(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

export default function DashboardPage() {
  const router = useRouter()
  const { isAdmin, user, isAuthenticated } = useUser()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  useEffect(() => {
    // Check sessionStorage cache first (valid for 5 minutes)
    const cacheKey = `dashboard_${isAdmin ? "admin" : user.name}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      try {
        const { data: cachedData, timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < 300000) { // 5 minutes
          setData(cachedData)
          setLoading(false)
          return
        }
      } catch {}
    }

    const params = new URLSearchParams()
    if (!isAdmin && user.name) {
      params.set("driver", user.name)
    }
    fetch(`/api/dashboard?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        // Save to cache
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: d, timestamp: Date.now() }))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isAdmin, user.name])

  if (!isAuthenticated) return null

  const quickActions = isAdmin
    ? [
        { label: "Input Orderan", href: "/deposit", icon: Wallet, color: "bg-primary" },
        { label: "Cek Lokasi", href: "/lokasi", icon: Car, color: "bg-chart-2" },
        { label: "Service", href: "/service", icon: Wrench, color: "bg-chart-3" },
      ]
    : [
        { label: "Setor", href: "/deposit", icon: Wallet, color: "bg-primary" },
        { label: "Riwayat", href: "/history", icon: TrendingUp, color: "bg-chart-2" },
        { label: "Profil", href: "/profile", icon: Users, color: "bg-chart-3" },
      ]

  return (
    <div className="min-h-screen pb-24">
      <MobileHeader showGreeting />

      <div className="px-4 py-4 space-y-5">
        {/* Balance Card - highlighted hero */}
        <Card className="bg-primary/[0.15] dark:bg-primary/15 border-primary/25 dark:border-primary/20 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-5 py-6 relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/70 dark:text-primary/80">
                  {isAdmin ? "Pendapatan Perusahaan Bulan Ini (40%)" : "Pendapatan Bulan Ini (60%)"}
                </p>
                <p className="text-[1.75rem] font-extrabold text-foreground mt-1 tracking-tight">
                  {loading ? "..." : `Rp ${formatRupiah(isAdmin ? (data?.monthlyCompanyShare || 0) : (data?.monthlyDriverShare || 0))}`}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-primary/10 dark:bg-primary/20 mt-4">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              {data ? (() => {
                const current = isAdmin ? data.monthlyCompanyShare : data.monthlyDriverShare
                const last = isAdmin ? data.lastMonthCompanyShare : data.lastMonthDriverShare
                const pct = last > 0 ? Math.round(((current - last) / last) * 100) : 0
                const isUp = current >= last
                return (
                  <>
                    {isUp ? <ArrowUpRight className="h-3.5 w-3.5 text-success" /> : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />}
                    <span className={cn("text-xs font-semibold", isUp ? "text-success" : "text-destructive")}>
                      {isUp ? "+" : ""}{pct}%
                    </span>
                    <span className="text-xs text-muted-foreground">dari bulan lalu</span>
                  </>
                )
              })() : (
                <span className="text-xs text-muted-foreground">Memuat...</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions - refined with icon glow */}
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-card border border-border active:scale-[0.97] transition-all"
            >
              <div className={cn("p-3 rounded-xl", action.color, "shadow-sm")}>
                <action.icon className="h-5 w-5 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">{action.label}</span>
            </Link>
          ))}
        </div>

        {/* Loading Skeleton */}
        {loading && <SkeletonDashboard />}

        {!loading && (
        <>
        {/* Stats Grid - compact premium */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-border bg-card">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                {data && data.lastMonthCompanyShare > 0 && (
                  <span className={cn("text-[11px] font-semibold", data.monthlyCompanyShare >= data.lastMonthCompanyShare ? "text-success" : "text-destructive")}>
                    {data.monthlyCompanyShare >= data.lastMonthCompanyShare ? "↑" : "↓"}{Math.abs(Math.round(((data.monthlyCompanyShare - data.lastMonthCompanyShare) / data.lastMonthCompanyShare) * 100))}%
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-foreground mt-2 tracking-tight">
                {loading ? "..." : `Rp ${formatRupiah(data?.monthlyCompanyShare || 0)}`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isAdmin ? "Masuk Perusahaan (40%)" : "Wajib Setor (40%)"}
              </p>
            </CardContent>
          </Card>

          <Link href="/drivers">
          <Card className="border-border bg-card cursor-pointer active:scale-[0.97] transition-transform">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-chart-2/10">
                  {isAdmin ? <Users className="h-4 w-4 text-chart-2" /> : <Car className="h-4 w-4 text-chart-2" />}
                </div>
                {data && data.monthlyCount > 0 && (
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {data.monthlyCount} trip
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-foreground mt-2 tracking-tight">
                {loading ? "..." : isAdmin ? (data?.activeDrivers || 0) : (data?.monthlyCount || 0)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isAdmin ? "Driver Aktif" : "Trip Bulan Ini"}
              </p>
            </CardContent>
          </Card>
          </Link>

          <Card className="border-border bg-card">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-warning/10">
                  <Clock className="h-4 w-4 text-warning" />
                </div>
                {data && data.pendingTotal > 0 && (
                  <span className="text-[11px] font-semibold text-warning">
                    Rp {formatRupiah(data.pendingTotal)}
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-foreground mt-2 tracking-tight">
                {loading ? "..." : data?.pendingCount || 0}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isAdmin ? "Belum Disetor" : "Hutang Setoran"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-success/10">
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
                {data && data.todayCount > 0 && (
                  <span className="text-[11px] font-semibold text-success">
                    +{data.todayCount} trip
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-foreground mt-2 tracking-tight">
                {loading ? "..." : `Rp ${formatRupiah(data?.todayTotal || 0)}`}
              </p>
              <p className="text-[11px] text-muted-foreground">Hari Ini</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts - Lazy loaded for performance */}
        {data && (
          <DashboardCharts
            monthlyChart={data.monthlyChart}
            driverIncome={data.driverIncome}
            orderTypeBreakdown={data.orderTypeBreakdown}
            isAdmin={isAdmin}
            formatRupiah={formatRupiah}
          />
        )}

        {/* Recent Transactions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Transaksi Terbaru</h2>
            <Link href="/history" className="flex items-center text-xs font-semibold text-primary">
              Lihat Semua
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <Card className="border-border bg-card">
            <CardContent className="p-0 divide-y divide-border">
              {loading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Memuat...</div>
              ) : data?.recentTransactions && data.recentTransactions.length > 0 ? (
                data.recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2.5 rounded-xl",
                          tx.orderType === "online" ? "bg-primary/10" : "bg-chart-3/10"
                        )}
                      >
                        {tx.orderType === "online" ? (
                          <Smartphone className="h-4 w-4 text-primary" />
                        ) : (
                          <Banknote className="h-4 w-4 text-chart-3" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{tx.driver}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {tx.origin} → {tx.destination}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground tracking-tight">
                        Rp {formatRupiah(tx.companyShare)}
                      </p>
                      <p
                        className={cn(
                          "text-[11px] font-semibold mt-0.5",
                          tx.status === "lunas" ? "text-success" : "text-warning"
                        )}
                      >
                        {tx.status === "lunas" ? "Lunas" : "Nunggak"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Belum ada transaksi
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </>
        )}
      </div>
    </div>
  )
}
