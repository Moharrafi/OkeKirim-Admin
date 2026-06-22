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
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useUser } from "@/lib/user-context"
import dynamic from "next/dynamic"
import { SkeletonDashboard } from "@/components/skeleton-dashboard"
import { PullToRefresh } from "@/components/pull-to-refresh"

const DashboardCharts = dynamic(() => import("@/components/dashboard-charts"), {
  ssr: false,
  loading: () => (
    <div className="h-48 rounded-xl border border-border bg-card p-3">
      <div className="h-full w-full animate-pulse rounded-lg bg-muted" />
    </div>
  ),
})
const DASHBOARD_CACHE_TTL = 5 * 60 * 1000

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
  pendingDebtTotal?: number
  pendingDebtCount?: number
  todayTotal: number
  todayCount: number
  activeDrivers: number
  overdueCount: number
  driverChartMonth?: string
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

function ActionTile({
  label,
  href,
  icon: Icon,
  tone,
}: {
  label: string
  href: string
  icon: LucideIcon
  tone: Tone
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[86px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl bg-secondary/45 px-2 py-3 text-center transition-transform active:scale-[0.98]"
    >
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-full shadow-sm", toneClass[tone].icon)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-[13px] font-semibold leading-none text-foreground">{label}</p>
    </Link>
  )
}

function SummaryRow({
  label,
  value,
  helper,
  icon: Icon,
  tone,
  meta,
  href,
}: {
  label: string
  value: string
  helper: string
  icon: LucideIcon
  tone: Tone
  meta?: string
  href?: string
}) {
  const content = (
    <div className="grid min-h-[72px] grid-cols-[auto,1fr] gap-3 rounded-2xl px-3 py-3.5 transition-colors active:bg-secondary/70">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", toneClass[tone].soft)}>
        <Icon className={cn("h-4 w-4", toneClass[tone].text)} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 text-base font-semibold leading-tight text-foreground">{label}</p>
          <p className="shrink-0 text-xl font-bold leading-tight tracking-tight text-foreground">{value}</p>
        </div>
        <div className="mt-1 flex items-start justify-between gap-3">
          <p className="min-w-0 text-sm leading-tight text-muted-foreground">{helper}</p>
          {meta && <p className="shrink-0 text-right text-xs font-medium leading-tight text-muted-foreground">{meta}</p>}
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    )
  }

  return content
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-bold leading-none text-foreground">{title}</h2>
      {subtitle && <p className="mt-1 text-sm leading-tight text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { isAdmin, user, isAuthenticated } = useUser()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSlide, setActiveSlide] = useState(0)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const scrollLeft = container.scrollLeft
    const width = container.clientWidth
    const index = Math.round(scrollLeft / width)
    setActiveSlide(index)
  }

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
        const isFresh = typeof timestamp === "number" && Date.now() - timestamp < DASHBOARD_CACHE_TTL
        const hasExpectedShape = cachedData && Array.isArray(cachedData.monthlyChart) && Array.isArray(cachedData.driverIncome)
        if (isFresh && hasExpectedShape) {
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

  const quickActions = isAdmin
    ? [
        { label: "Orderan", href: "/deposit", icon: Wallet, tone: "primary" as const },
        { label: "Lokasi", href: "/lokasi", icon: Car, tone: "blue" as const },
        { label: "Service", href: "/service", icon: Wrench, tone: "amber" as const },
      ]
    : [
        { label: "Setor", href: "/deposit", icon: Wallet, tone: "primary" as const },
        { label: "Riwayat", href: "/history", icon: TrendingUp, tone: "blue" as const },
        { label: "Profil", href: "/profile", icon: Users, tone: "amber" as const },
      ]

  const handleRefresh = async () => {
    const params = new URLSearchParams()
    if (!isAdmin && user.name) params.set("driver", user.name)
    const res = await fetch(`/api/dashboard?${params.toString()}`)
    const d = await res.json()
    setData(d)
    const cacheKey = `dashboard_${isAdmin ? "admin" : user.name}`
    sessionStorage.setItem(cacheKey, JSON.stringify({ data: d, timestamp: Date.now() }))
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="min-h-screen pb-28">
      <MobileHeader showGreeting overdueCount={data?.overdueCount || 0} />

      <main className="px-4 py-4">
        <section className="space-y-3">
          <Card className="rounded-2xl border-primary/20 bg-primary/10 dark:bg-primary/15 py-0 shadow-sm">
            <CardContent className="p-5 pb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary">
                    {isAdmin ? "Pendapatan perusahaan bulan ini" : "Pendapatan bulan ini"}
                  </p>
                  <p className="mt-2 text-[2rem] font-bold leading-tight tracking-tight text-foreground">
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
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5">
                  <span className="text-xs font-medium text-primary/70">Trip</span>
                  <span className="text-xs font-bold text-primary">{loading ? "..." : data?.monthlyCount || 0}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1.5">
                  <span className="text-xs font-medium text-blue-500/70">{isAdmin ? "Driver" : "Argo"}</span>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
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

          <Card className="rounded-[22px] border-border bg-card py-0 shadow-sm">
            <CardContent className="grid grid-cols-3 gap-2 p-2.5">
              {quickActions.map((action) => (
                <ActionTile key={action.href} {...action} />
              ))}
            </CardContent>
          </Card>
        </section>

        {loading && (
          <div className="mt-4">
            <SkeletonDashboard />
          </div>
        )}

        {!loading && (
          <section className="mt-5 space-y-5">
            <section>
              <SectionHeader title="Ringkasan" subtitle="Angka utama bulan ini" />
              {isAdmin ? (
                <>
                  <div
                    className="flex overflow-x-auto pb-1 snap-x snap-mandatory -mx-4 scroll-smooth no-scrollbar"
                    onScroll={handleScroll}
                  >
                    {/* Slide 1: 2x2 Grid */}
                    <div className="w-full shrink-0 snap-start grid grid-cols-2 grid-rows-2 gap-2.5 px-4">
                      <Card className="rounded-xl border-border bg-card py-0 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="p-1.5 rounded-lg bg-primary/10">
                              <Wallet className="h-3.5 w-3.5 text-primary" />
                            </div>
                            {trend && (
                              <span className={cn("text-[10px] font-bold", trend.isUp ? "text-success" : "text-destructive")}>
                                {trend.isUp ? "↑" : "↓"}{Math.abs(trend.percent)}%
                              </span>
                            )}
                          </div>
                          <p className="text-base font-bold text-foreground mt-2 tracking-tight">
                            Rp {formatRupiah(data?.monthlyCompanyShare || 0)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Perusahaan (40%)</p>
                        </CardContent>
                      </Card>

                      <Link href="/drivers">
                        <Card className="rounded-xl border-border bg-card py-0 shadow-sm h-full">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="p-1.5 rounded-lg bg-blue-500/10">
                                <Users className="h-3.5 w-3.5 text-blue-500" />
                              </div>
                              {data?.monthlyCount ? (
                                <span className="text-[10px] font-medium text-muted-foreground">{data.monthlyCount} trip</span>
                              ) : null}
                            </div>
                            <p className="text-base font-bold text-foreground mt-2 tracking-tight">
                              {data?.activeDrivers || 0}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Driver Aktif</p>
                          </CardContent>
                        </Card>
                      </Link>

                      <Card className="rounded-xl border-border bg-card py-0 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="p-1.5 rounded-lg bg-amber-500/10">
                              <Clock className="h-3.5 w-3.5 text-amber-500" />
                            </div>
                            {data?.pendingTotal ? (
                              <span className="text-[10px] font-semibold text-amber-500">Rp {formatRupiah(data.pendingTotal)}</span>
                            ) : null}
                          </div>
                          <p className="text-base font-bold text-foreground mt-2 tracking-tight">
                            {data?.pendingCount || 0}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Belum Disetor</p>
                        </CardContent>
                      </Card>

                      <Card className="rounded-xl border-border bg-card py-0 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10">
                              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                            </div>
                            {data?.todayCount ? (
                              <span className="text-[10px] font-semibold text-emerald-500">+{data.todayCount} trip</span>
                            ) : null}
                          </div>
                          <p className="text-base font-bold text-foreground mt-2 tracking-tight">
                            Rp {formatRupiah(data?.todayTotal || 0)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Hari Ini</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Slide 2: 2x2 Grid (containing Hutang card) */}
                    <div className="w-full shrink-0 snap-start grid grid-cols-2 grid-rows-2 gap-2.5 px-4">
                      <Link href="/hutang">
                        <Card className="rounded-xl border-border bg-card py-0 shadow-sm h-full">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="p-1.5 rounded-lg bg-red-500/10">
                                <Banknote className="h-3.5 w-3.5 text-red-500" />
                              </div>
                              {data?.pendingDebtCount ? (
                                <span className="text-[10px] font-semibold text-red-500">{data.pendingDebtCount} kasbon</span>
                              ) : null}
                            </div>
                            <p className="text-base font-bold text-foreground mt-2 tracking-tight">
                              Rp {formatRupiah(data?.pendingDebtTotal || 0)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Hutang Kasbon</p>
                          </CardContent>
                        </Card>
                      </Link>

                      {/* Spacer columns to match standard 2x2 grid layout and card dimensions */}
                      <div className="h-full" />
                      <div className="h-full" />
                      <div className="h-full" />
                    </div>
                  </div>

                  {/* Dot Indicators */}
                  <div className="mt-2.5 flex justify-center gap-1.5">
                    <span className={cn("h-1.5 rounded-full transition-all duration-300", activeSlide === 0 ? "bg-primary w-3.5" : "bg-muted-foreground/30 w-1.5")} />
                    <span className={cn("h-1.5 rounded-full transition-all duration-300", activeSlide === 1 ? "bg-primary w-3.5" : "bg-muted-foreground/30 w-1.5")} />
                  </div>
                </>
              ) : (
                /* Driver View: Static 2x2 Grid without slide mechanism */
                <div className="grid grid-cols-2 gap-2.5">
                  <Card className="rounded-xl border-border bg-card py-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <Wallet className="h-3.5 w-3.5 text-primary" />
                        </div>
                        {trend && (
                          <span className={cn("text-[10px] font-bold", trend.isUp ? "text-success" : "text-destructive")}>
                            {trend.isUp ? "↑" : "↓"}{Math.abs(trend.percent)}%
                          </span>
                        )}
                      </div>
                      <p className="text-base font-bold text-foreground mt-2 tracking-tight">
                        Rp {formatRupiah(data?.monthlyCompanyShare || 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Wajib Setor</p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl border-border bg-card py-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="p-1.5 rounded-lg bg-blue-500/10">
                          <Users className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        {data?.monthlyCount ? (
                          <span className="text-[10px] font-medium text-muted-foreground">{data.monthlyCount} trip</span>
                        ) : null}
                      </div>
                      <p className="text-base font-bold text-foreground mt-2 tracking-tight">
                        {data?.monthlyCount || 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Trip Bulan Ini</p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl border-border bg-card py-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="p-1.5 rounded-lg bg-amber-500/10">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                        {data?.pendingTotal ? (
                          <span className="text-[10px] font-semibold text-amber-500">Rp {formatRupiah(data.pendingTotal)}</span>
                        ) : null}
                      </div>
                      <p className="text-base font-bold text-foreground mt-2 tracking-tight">
                        {data?.pendingCount || 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Hutang Setoran</p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl border-border bg-card py-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                        </div>
                        {data?.todayCount ? (
                          <span className="text-[10px] font-semibold text-emerald-500">+{data.todayCount} trip</span>
                        ) : null}
                      </div>
                      <p className="text-base font-bold text-foreground mt-2 tracking-tight">
                        Rp {formatRupiah(data?.todayTotal || 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Hari Ini</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </section>

            {data && (
              <DashboardCharts
                monthlyChart={data.monthlyChart}
                driverIncome={data.driverIncome}
                orderTypeBreakdown={data.orderTypeBreakdown}
                isAdmin={isAdmin}
                formatRupiah={formatRupiah}
                currentDriver={user.name}
                driverChartMonth={data.driverChartMonth}
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
    </PullToRefresh>
  )
}

