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
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useUser } from "@/lib/user-context"
import dynamic from "next/dynamic"
import { SkeletonDashboard } from "@/components/skeleton-dashboard"

const DashboardCharts = dynamic(() => import("@/components/dashboard-charts"), {
  ssr: false,
  loading: () => (
    <div className="h-48 rounded-xl border border-border bg-card p-3">
      <div className="h-full w-full animate-pulse rounded-lg bg-muted" />
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

type Tone = "primary" | "blue" | "amber" | "green"

const toneClass: Record<Tone, { icon: string; soft: string; text: string }> = {
  primary: {
    icon: "bg-primary text-primary-foreground",
    soft: "bg-primary/10",
    text: "text-primary",
  },
  blue: {
    icon: "bg-chart-2 text-white",
    soft: "bg-chart-2/10",
    text: "text-chart-2",
  },
  amber: {
    icon: "bg-chart-3 text-white",
    soft: "bg-chart-3/10",
    text: "text-chart-3",
  },
  green: {
    icon: "bg-success text-white",
    soft: "bg-success/10",
    text: "text-success",
  },
}

function formatRupiah(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

function getTrend(current: number, previous: number) {
  if (previous <= 0) return null
  const percent = Math.round(((current - previous) / previous) * 100)
  return { percent, isUp: current >= previous }
}

interface QuickAction {
  label: string
  description: string
  href: string
  icon: LucideIcon
  tone: Tone
}

function QuickActionPanel({ actions }: { actions: QuickAction[] }) {
  const primary = actions[0]
  const secondary = actions.slice(1)
  const PrimaryIcon = primary.icon

  return (
    <Card className="rounded-2xl border-border bg-card py-0 shadow-sm">
      <CardContent className="p-3">
        <Link
          href={primary.href}
          className="flex items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3.5 text-primary-foreground transition-transform active:scale-[0.99]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <PrimaryIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight">{primary.label}</p>
              <p className="mt-0.5 truncate text-xs text-primary-foreground/75">{primary.description}</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0" aria-hidden="true" />
        </Link>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {secondary.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-2 rounded-xl px-3 py-3 transition-colors active:bg-secondary"
              >
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", toneClass[action.tone].soft)}>
                  <Icon className={cn("h-4 w-4", toneClass[action.tone].text)} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight text-foreground">{action.label}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{action.description}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function MiniStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  icon: LucideIcon
  tone: Tone
}) {
  return (
    <div className="rounded-xl bg-secondary/45 p-3">
      <div className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-lg", toneClass[tone].soft)}>
        <Icon className={cn("h-4 w-4", toneClass[tone].text)} aria-hidden="true" />
      </div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-bold leading-tight text-foreground">{value}</p>
    </div>
  )
}

function SummaryPanel({
  isAdmin,
  data,
  trendText,
}: {
  isAdmin: boolean
  data: DashboardData | null
  trendText?: string
}) {
  const companyShare = data?.monthlyCompanyShare || 0
  const pendingCount = data?.pendingCount || 0
  const pendingTotal = data?.pendingTotal || 0
  const driverOrTrip = isAdmin ? data?.activeDrivers || 0 : data?.monthlyCount || 0

  return (
    <section>
      <SectionHeader title="Ringkasan" subtitle="Setoran dan aktivitas utama" />
      <Card className="rounded-2xl border-border bg-card py-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{isAdmin ? "Masuk perusahaan" : "Wajib setor"}</p>
              <p className="mt-1 text-2xl font-bold leading-tight tracking-tight text-foreground">
                Rp {formatRupiah(companyShare)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pendingCount} belum disetor
                {pendingTotal > 0 ? ` - Rp ${formatRupiah(pendingTotal)} tertunda` : ""}
              </p>
            </div>
            {trendText && (
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {trendText}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat
              label={isAdmin ? "Driver aktif" : "Trip bulan ini"}
              value={String(driverOrTrip)}
              icon={isAdmin ? Users : Car}
              tone="blue"
            />
            <MiniStat
              label="Hari ini"
              value={`Rp ${formatRupiah(data?.todayTotal || 0)}`}
              icon={TrendingUp}
              tone="green"
            />
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-bold leading-none text-foreground">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  )
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
    const cacheKey = `dashboard_${isAdmin ? "admin" : user.name}`
    const cached = sessionStorage.getItem(cacheKey)

    if (cached) {
      try {
        const { data: cachedData, timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < 300000) {
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
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: d, timestamp: Date.now() }))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isAdmin, user.name])

  if (!isAuthenticated) return null

  const primaryAmount = isAdmin ? data?.monthlyCompanyShare || 0 : data?.monthlyDriverShare || 0
  const previousAmount = isAdmin ? data?.lastMonthCompanyShare || 0 : data?.lastMonthDriverShare || 0
  const trend = data ? getTrend(primaryAmount, previousAmount) : null
  const trendText = trend ? `${trend.percent >= 0 ? "+" : ""}${trend.percent}%` : undefined

  const quickActions = isAdmin
    ? [
        { label: "Input Orderan", description: "Catat perjalanan baru", href: "/deposit", icon: Wallet, tone: "primary" as const },
        { label: "Lokasi", description: "Pantau armada", href: "/lokasi", icon: Car, tone: "blue" as const },
        { label: "Service", description: "Jadwal bengkel", href: "/service", icon: Wrench, tone: "amber" as const },
      ]
    : [
        { label: "Setor Sekarang", description: "Bayar setoran tertunda", href: "/deposit", icon: Wallet, tone: "primary" as const },
        { label: "Riwayat", description: "Cek transaksi", href: "/history", icon: TrendingUp, tone: "blue" as const },
        { label: "Profil", description: "Data driver", href: "/profile", icon: Users, tone: "amber" as const },
      ]

  return (
    <div className="min-h-screen pb-28">
      <MobileHeader showGreeting />

      <main className="px-4 py-4">
        <section className="space-y-4">
          <Card className="rounded-3xl border-primary/15 bg-card py-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary">
                    {isAdmin ? "Pendapatan perusahaan bulan ini" : "Pendapatan bulan ini"}
                  </p>
                  <p className="mt-2 text-[2.1rem] font-bold leading-tight tracking-tight text-foreground">
                    {loading ? "..." : `Rp ${formatRupiah(primaryAmount)}`}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {trend ? (
                      <>
                        {trend.isUp ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <span className={cn("text-xs font-semibold", trend.isUp ? "text-success" : "text-destructive")}>
                          {trend.isUp ? "+" : ""}
                          {trend.percent}%
                        </span>
                        <span className="text-xs text-muted-foreground">dari bulan lalu</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">{loading ? "Memuat data..." : "Data bulan ini"}</span>
                    )}
                  </div>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <div className="rounded-full bg-secondary px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">Trip </span>
                  <span className="text-xs font-semibold text-foreground">{loading ? "..." : `${data?.monthlyCount || 0}`}</span>
                </div>
                <div className="rounded-full bg-secondary px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">{isAdmin ? "Driver " : "Argo "}</span>
                  <span className="text-xs font-semibold text-foreground">
                    {loading
                      ? "..."
                      : isAdmin
                        ? `${data?.activeDrivers || 0} aktif`
                        : `Rp ${formatRupiah(data?.monthlyFare || 0)}`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <QuickActionPanel actions={quickActions} />
        </section>

        {loading && (
          <div className="mt-4">
            <SkeletonDashboard />
          </div>
        )}

        {!loading && (
          <section className="mt-5 space-y-5">
            <SummaryPanel isAdmin={isAdmin} data={data} trendText={trendText} />

            {data && (
              <DashboardCharts
                monthlyChart={data.monthlyChart}
                driverIncome={data.driverIncome}
                orderTypeBreakdown={data.orderTypeBreakdown}
                isAdmin={isAdmin}
                formatRupiah={formatRupiah}
              />
            )}

            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Transaksi Terbaru</h2>
                  <p className="text-[11px] text-muted-foreground">Aktivitas setoran terakhir</p>
                </div>
                <Link href="/history" className="flex items-center text-xs font-semibold text-primary">
                  Lihat
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <Card className="rounded-xl border-border bg-card py-0 shadow-sm">
                <CardContent className="divide-y divide-border p-0">
                  {data?.recentTransactions && data.recentTransactions.length > 0 ? (
                    data.recentTransactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between gap-3 p-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                              tx.orderType === "online" ? "bg-primary/10" : "bg-chart-3/10"
                            )}
                          >
                            {tx.orderType === "online" ? (
                              <Smartphone className="h-4 w-4 text-primary" />
                            ) : (
                              <Banknote className="h-4 w-4 text-chart-3" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{tx.driver}</p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {tx.origin} - {tx.destination}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold tracking-tight text-foreground">Rp {formatRupiah(tx.companyShare)}</p>
                          <p className={cn("mt-0.5 text-[11px] font-semibold", tx.status === "lunas" ? "text-success" : "text-warning")}>
                            {tx.status === "lunas" ? "Lunas" : "Nunggak"}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-5 text-center text-sm text-muted-foreground">Belum ada transaksi</div>
                  )}
                </CardContent>
              </Card>
            </section>
          </section>
        )}
      </main>
    </div>
  )
}
