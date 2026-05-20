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
      className="flex min-w-0 flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition-colors active:bg-secondary"
    >
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", toneClass[tone].icon)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-xs font-semibold leading-none text-foreground">{label}</p>
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
    <div className="flex min-h-[68px] items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors active:bg-secondary/70">
      <div className="flex min-w-0 items-center gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneClass[tone].soft)}>
          <Icon className={cn("h-4 w-4", toneClass[tone].text)} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-foreground">{label}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{helper}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-lg font-bold leading-tight tracking-tight text-foreground">{value}</p>
        {meta && <p className="mt-1 text-xs font-medium text-muted-foreground">{meta}</p>}
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

  return (
    <div className="min-h-screen pb-28">
      <MobileHeader showGreeting />

      <main className="px-4 py-4">
        <section className="space-y-3">
          <Card className="rounded-2xl border-primary/15 bg-card py-0 shadow-sm">
            <CardContent className="p-5">
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

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Trip bulan ini</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{loading ? "..." : `${data?.monthlyCount || 0} trip`}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isAdmin ? "Driver aktif" : "Total argo"}</p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {loading
                      ? "..."
                      : isAdmin
                        ? `${data?.activeDrivers || 0} driver`
                        : `Rp ${formatRupiah(data?.monthlyFare || 0)}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card py-0 shadow-sm">
            <CardContent className="grid grid-cols-3 gap-1 p-2">
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
              <Card className="rounded-2xl border-border bg-card py-0 shadow-sm">
                <CardContent className="divide-y divide-border p-2">
                  <SummaryRow
                    label={isAdmin ? "Perusahaan" : "Wajib setor"}
                    helper={isAdmin ? "Masuk perusahaan 40%" : "Porsi setoran 40%"}
                    value={`Rp ${formatRupiah(data?.monthlyCompanyShare || 0)}`}
                    icon={Wallet}
                    tone="primary"
                    meta={trend ? `${trend.percent >= 0 ? "+" : ""}${trend.percent}%` : undefined}
                  />
                  <SummaryRow
                    label={isAdmin ? "Driver aktif" : "Trip"}
                    helper={isAdmin ? "Driver berstatus aktif" : "Total perjalanan bulan ini"}
                    value={String(isAdmin ? data?.activeDrivers || 0 : data?.monthlyCount || 0)}
                    icon={isAdmin ? Users : Car}
                    tone="blue"
                    meta={data?.monthlyCount ? `${data.monthlyCount} trip` : undefined}
                    href={isAdmin ? "/drivers" : undefined}
                  />
                  <SummaryRow
                    label={isAdmin ? "Pending" : "Hutang"}
                    helper="Belum disetor"
                    value={String(data?.pendingCount || 0)}
                    icon={Clock}
                    tone="amber"
                    meta={data?.pendingTotal ? `Rp ${formatRupiah(data.pendingTotal)}` : undefined}
                  />
                  <SummaryRow
                    label="Hari ini"
                    helper="Setoran masuk"
                    value={`Rp ${formatRupiah(data?.todayTotal || 0)}`}
                    icon={TrendingUp}
                    tone="green"
                    meta={data?.todayCount ? `${data.todayCount} trip` : undefined}
                  />
                </CardContent>
              </Card>
            </section>

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
