"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import {
  Wallet,
  Users,
  MapPin,
  TrendingUp,
  Wrench,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Smartphone,
  Banknote,
  Clock,
  FileText,
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
    icon: "bg-blue-500 text-white dark:bg-blue-600",
    soft: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
  },
  amber: {
    icon: "bg-amber-500 text-white dark:bg-amber-600",
    soft: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
  },
  green: {
    icon: "bg-emerald-500 text-white dark:bg-emerald-600",
    soft: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
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

function QuickActionTile({
  label,
  sublabel,
  href,
  icon: Icon,
  tone,
}: {
  label: string
  sublabel: string
  href: string
  icon: LucideIcon
  tone: Tone
}) {
  return (
    <Link
      href={href}
      className="flex-1 flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-card border border-border/40 hover:bg-slate-50 dark:hover:bg-slate-900 active:scale-95 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
    >
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl shadow-xs border border-border/30", toneClass[tone].soft)}>
        <Icon className={cn("h-5 w-5", toneClass[tone].text)} aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-[11px] font-extrabold text-foreground leading-tight">{label}</p>
        <p className="text-[8px] text-muted-foreground font-medium mt-0.5 leading-none">{sublabel}</p>
      </div>
    </Link>
  )
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
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSlide, setActiveSlide] = useState(0)
  const [statsTab, setStatsTab] = useState<"monthly" | "daily">("monthly")

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
    const servicesCacheKey = `dashboard_services_admin`
    const cached = sessionStorage.getItem(cacheKey)
    const cachedServices = sessionStorage.getItem(servicesCacheKey)

    let cachedDataParsed: any = null
    let cachedServicesParsed: any[] = []

    if (cached) {
      try {
        const { data: cachedData, timestamp } = JSON.parse(cached)
        const isFresh = typeof timestamp === "number" && Date.now() - timestamp < DASHBOARD_CACHE_TTL
        const hasExpectedShape = cachedData && Array.isArray(cachedData.monthlyChart) && Array.isArray(cachedData.driverIncome)
        if (isFresh && hasExpectedShape) {
          cachedDataParsed = cachedData
        }
      } catch {}
    }

    if (isAdmin && cachedServices) {
      try {
        const { data: cachedServs, timestamp } = JSON.parse(cachedServices)
        const isFresh = typeof timestamp === "number" && Date.now() - timestamp < DASHBOARD_CACHE_TTL
        if (isFresh && Array.isArray(cachedServs)) {
          cachedServicesParsed = cachedServs
        }
      } catch {}
    }

    if (cachedDataParsed && (!isAdmin || cachedServicesParsed.length > 0)) {
      setData(cachedDataParsed)
      if (isAdmin) {
        setServices(cachedServicesParsed)
      }
      setLoading(false)
      return
    }

    const params = new URLSearchParams()
    if (!isAdmin && user.name) {
      params.set("driver", user.name)
    }

    setLoading(true)
    const promises: Promise<any>[] = [
      fetch(`/api/dashboard?${params.toString()}`).then((r) => r.json())
    ]

    if (isAdmin) {
      promises.push(fetch("/api/services").then((r) => r.json()))
    }

    Promise.all(promises)
      .then(([dashData, servData]) => {
        setData(dashData)
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: dashData, timestamp: Date.now() }))
        
        if (isAdmin && servData && Array.isArray(servData.services)) {
          setServices(servData.services)
          sessionStorage.setItem(servicesCacheKey, JSON.stringify({ data: servData.services, timestamp: Date.now() }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isAdmin, user.name])

  if (!isAuthenticated) return null

  // Total service cost calculation (current month vs last month)
  const serviceStats = useMemo(() => {
    if (!isAdmin || services.length === 0) return { currentMonth: 0, lastMonth: 0 }
    
    const now = new Date()
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`

    let currentMonthTotal = 0
    let lastMonthTotal = 0

    services.forEach(s => {
      if (!s.date) return
      if (s.date.startsWith(currentMonthStr)) {
        currentMonthTotal += Number(s.cost || 0)
      } else if (s.date.startsWith(lastMonthStr)) {
        lastMonthTotal += Number(s.cost || 0)
      }
    })

    return {
      currentMonth: currentMonthTotal,
      lastMonth: lastMonthTotal
    }
  }, [isAdmin, services])

  const monthlyAmount = isAdmin ? (data?.monthlyCompanyShare || 0) - serviceStats.currentMonth : data?.monthlyDriverShare || 0
  const previousAmount = isAdmin ? (data?.lastMonthCompanyShare || 0) - serviceStats.lastMonth : data?.lastMonthDriverShare || 0
  const trend = data ? getTrend(monthlyAmount, previousAmount) : null
  const grossTrend = data ? getTrend(data.monthlyCompanyShare || 0, data.lastMonthCompanyShare || 0) : null

  const activeAmount = statsTab === "monthly" ? monthlyAmount : (data?.todayTotal || 0)
  const activeTripsCount = statsTab === "monthly" ? (data?.monthlyCount || 0) : (data?.todayCount || 0)

  const quickActions = isAdmin
    ? [
        { label: "Orderan", sublabel: "Input Setoran", href: "/deposit", icon: Wallet, tone: "primary" as const },
        { label: "Lokasi", sublabel: "Peta Armada", href: "/lokasi", icon: MapPin, tone: "blue" as const },
        { label: "Service", sublabel: "Servis Truk", href: "/service", icon: Wrench, tone: "amber" as const },
        { label: "Dokumen", sublabel: "KIR & Pajak", href: "/documents", icon: FileText, tone: "green" as const },
      ]
    : [
        { label: "Setor", sublabel: "Input Setoran", href: "/deposit", icon: Wallet, tone: "primary" as const },
        { label: "Riwayat", sublabel: "Catatan Trip", href: "/history", icon: TrendingUp, tone: "blue" as const },
        { label: "Profil", sublabel: "Data Driver", href: "/profile", icon: Users, tone: "amber" as const },
      ]

  const handleRefresh = async () => {
    const params = new URLSearchParams()
    if (!isAdmin && user.name) params.set("driver", user.name)
    
    const promises: Promise<any>[] = [
      fetch(`/api/dashboard?${params.toString()}`).then((r) => r.json())
    ]
    if (isAdmin) {
      promises.push(fetch("/api/services").then((r) => r.json()))
    }

    try {
      const [d, servData] = await Promise.all(promises)
      setData(d)
      const cacheKey = `dashboard_${isAdmin ? "admin" : user.name}`
      sessionStorage.setItem(cacheKey, JSON.stringify({ data: d, timestamp: Date.now() }))

      if (isAdmin && servData && Array.isArray(servData.services)) {
        setServices(servData.services)
        const servicesCacheKey = `dashboard_services_admin`
        sessionStorage.setItem(servicesCacheKey, JSON.stringify({ data: servData.services, timestamp: Date.now() }))
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="min-h-screen pb-28">
      <MobileHeader title="OkeMitra" overdueCount={data?.overdueCount || 0} variant="dark" />

      <main className="px-4 py-4 space-y-5">
        {/* Immersive Blue Fintech Header Panel */}
        <div className="relative bg-primary text-white pb-20 pt-5 px-4 -mx-4 -mt-4 rounded-b-none shadow-md overflow-hidden border-none">

          {/* Sapaan & Profil Row inside the Blue Panel */}
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white font-extrabold text-sm border border-white/20 shadow-inner">
                  {user.name.split(" ").map(n => n[0]).join("")}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-primary animate-pulse" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300 tracking-wider">
                  {isAdmin ? "ADMIN CONSOLE" : "DRIVE ACTIVE"}
                </span>
                <h2 className="text-sm font-extrabold text-white leading-none mt-1 truncate">
                  Halo, {user.name.split(" ")[0]}!
                </h2>
                <p className="text-[10px] text-slate-300 mt-1 leading-none font-semibold opacity-85">
                  {isAdmin ? "Sistem Setoran OkeKirim" : "B 1234 ABC • Hino Ranger"}
                </p>
              </div>
            </div>
            <Link href="/profile" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors active:scale-95">
              <Users className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Unified Wallet Card */}
        <div className="relative -mt-20 mx-0 z-10 px-0">
          <div className="relative rounded-3xl bg-card text-foreground shadow-xl p-5 overflow-hidden border border-border/80">
            
            {/* Header Switcher Row inside E-Wallet Card */}
            <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
              <span className="text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase">
                {statsTab === "monthly" 
                  ? (isAdmin ? "Laba Bersih Perusahaan" : "Total Pendapatan Supir")
                  : (isAdmin ? "Setoran Hari Ini" : "Pendapatan Hari Ini")}
              </span>
              <div className="flex rounded-full bg-secondary p-0.5 border border-border/60">
                <button
                  onClick={() => setStatsTab("monthly")}
                  className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-extrabold transition-all",
                    statsTab === "monthly" 
                      ? "bg-blue-600 text-white shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Bulan Ini
                </button>
                <button
                  onClick={() => setStatsTab("daily")}
                  className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-extrabold transition-all",
                    statsTab === "daily" 
                      ? "bg-blue-600 text-white shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Hari Ini
                </button>
              </div>
            </div>

            {/* Balance Amount Info */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-bold text-muted-foreground">IDR</span>
                  <p className="text-3xl font-black leading-none tracking-tight text-foreground">
                    {loading ? "..." : formatRupiah(activeAmount)}
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  {statsTab === "monthly" && trend ? (
                    <>
                      <div className={cn("flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold", trend.isUp ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
                        {trend.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        <span>{trend.isUp ? "+" : ""}{trend.percent}%</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">vs bulan lalu</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {loading ? "Memuat..." : statsTab === "daily" ? "Akumulasi hari ini" : "Data berjalan bulan ini"}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-xs">
                <Wallet className="h-5 w-5" />
              </div>
            </div>

            {/* Small metrics info row */}
            <div className="mt-5 flex gap-4 text-[10px] text-muted-foreground border-t border-border/50 pt-3">
              <div>
                <span className="opacity-75">Trip: </span>
                <strong className="text-foreground font-extrabold">{loading ? "..." : activeTripsCount}</strong>
              </div>
              <div className="h-3 w-px bg-border/60" />
              <div>
                <span className="opacity-75">{isAdmin ? "Driver Aktif: " : "Argo Berjalan: "}</span>
                <strong className="text-foreground font-extrabold">
                  {loading
                    ? "..."
                    : isAdmin
                      ? `${data?.activeDrivers || 0} supir`
                      : `Rp ${formatRupiah(data?.monthlyFare || 0)}`}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Unified Quick Actions Card (DANA style) */}
        <div className="rounded-3xl border border-border/70 bg-card shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-3 flex justify-between items-center gap-1">
          {quickActions.map((action) => {
            const config = toneClass[action.tone]
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex-1 flex flex-col items-center justify-center gap-1.5 py-0.5 active:scale-[0.96] transition-all text-center group"
              >
                <div className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl shadow-xs border transition-all duration-200 group-hover:scale-105",
                  config.soft,
                  "border-border/30"
                )}>
                  <action.icon className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[11px] font-extrabold text-foreground leading-tight group-hover:text-blue-600 transition-colors">{action.label}</p>
                  <p className="text-[8px] text-muted-foreground font-medium leading-none">{action.sublabel}</p>
                </div>
              </Link>
            )
          })}
        </div>

        {loading && (
          <div className="mt-4">
            <SkeletonDashboard />
          </div>
        )}

        {!loading && (
          <section className="mt-5 space-y-5">
            {/* 1. Ringkasan (Consolidated into 2x2 Grid of Cards - Compact & Minimalist) */}
            <section>
              <SectionHeader title="Ringkasan" subtitle="Angka utama bulan ini" />
              <div className="grid grid-cols-2 gap-3 mt-3">
                {isAdmin ? (
                  <>
                    {/* Card 1: Perusahaan */}
                    <Card className="rounded-xl border border-border/70 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-all active:scale-[0.98]">
                      <CardContent className="p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <Wallet className="h-3.5 w-3.5" />
                          </div>
                          {grossTrend && (
                            <span className={cn("text-[9px] font-extrabold px-1.5 py-0.5 rounded-full", grossTrend.isUp ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400")}>
                              {grossTrend.isUp ? "↑" : "↓"}{Math.abs(grossTrend.percent)}%
                            </span>
                          )}
                        </div>
                        <div className="mt-2.5">
                          <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">Perusahaan (40%)</p>
                          <p className="text-sm font-extrabold text-foreground mt-0.5 truncate">
                            Rp {formatRupiah(data?.monthlyCompanyShare || 0)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Card 2: Driver Aktif */}
                    <Link href="/drivers" className="block">
                      <Card className="rounded-xl border border-border/70 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.01)] active:scale-[0.98] transition-all">
                        <CardContent className="p-3 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              <Users className="h-3.5 w-3.5" />
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                          </div>
                          <div className="mt-2.5">
                            <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">Driver Aktif</p>
                            <p className="text-sm font-extrabold text-foreground mt-0.5 truncate">
                              {data?.activeDrivers || 0} supir
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>

                    {/* Card 3: Belum Disetor */}
                    <Card className="rounded-xl border border-border/70 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-all active:scale-[0.98]">
                      <CardContent className="p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Clock className="h-3.5 w-3.5" />
                          </div>
                          {data?.pendingCount ? (
                            <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                              {data.pendingCount} trip
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2.5">
                          <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">Belum Disetor</p>
                          <p className="text-sm font-extrabold text-foreground mt-0.5 truncate">
                            Rp {formatRupiah(data?.pendingTotal || 0)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Card 4: Hutang Kasbon */}
                    <Link href="/hutang" className="block">
                      <Card className="rounded-xl border border-border/70 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.01)] active:scale-[0.98] transition-all">
                        <CardContent className="p-3 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <div className="p-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                              <Banknote className="h-3.5 w-3.5" />
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                          </div>
                          <div className="mt-2.5">
                            <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">Kasbon Supir</p>
                            <p className="text-sm font-extrabold text-foreground mt-0.5 truncate">
                              Rp {formatRupiah(data?.pendingDebtTotal || 0)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </>
                ) : (
                  <>
                    {/* Card 1: Wajib Setor */}
                    <Card className="rounded-xl border border-border/70 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-all active:scale-[0.98]">
                      <CardContent className="p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <Wallet className="h-3.5 w-3.5" />
                          </div>
                          {grossTrend && (
                            <span className={cn("text-[9px] font-extrabold px-1.5 py-0.5 rounded-full", grossTrend.isUp ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
                              {grossTrend.isUp ? "↑" : "↓"}{Math.abs(grossTrend.percent)}%
                            </span>
                          )}
                        </div>
                        <div className="mt-2.5">
                          <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">Wajib Setor</p>
                          <p className="text-sm font-extrabold text-foreground mt-0.5 truncate">
                            Rp {formatRupiah(data?.monthlyCompanyShare || 0)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Card 2: Trip Bulan Ini */}
                    <Card className="rounded-xl border border-border/70 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-all active:scale-[0.98]">
                      <CardContent className="p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <Users className="h-3.5 w-3.5" />
                          </div>
                        </div>
                        <div className="mt-2.5">
                          <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">Trip Bulan Ini</p>
                          <p className="text-sm font-extrabold text-foreground mt-0.5 truncate">
                            {data?.monthlyCount || 0} trip
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Card 3: Hutang Setoran */}
                    <Card className="rounded-xl border border-border/70 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-all active:scale-[0.98]">
                      <CardContent className="p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Clock className="h-3.5 w-3.5" />
                          </div>
                          {data?.pendingCount ? (
                            <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                              {data.pendingCount} order
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2.5">
                          <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">Hutang Setoran</p>
                          <p className="text-sm font-extrabold text-foreground mt-0.5 truncate">
                            Rp {formatRupiah(data?.pendingTotal || 0)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Card 4: Hari Ini */}
                    <Card className="rounded-xl border border-border/70 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-all active:scale-[0.98]">
                      <CardContent className="p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <TrendingUp className="h-3.5 w-3.5" />
                          </div>
                          {data?.todayCount ? (
                            <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                              +{data.todayCount} trip
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2.5">
                          <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">Hari Ini</p>
                          <p className="text-sm font-extrabold text-foreground mt-0.5 truncate">
                            Rp {formatRupiah(data?.todayTotal || 0)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </section>

            {/* 2. Grafik Analisis */}
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

            {/* 3. Transaksi Terbaru (Placed at the bottom!) */}
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

              <Card className="rounded-2xl border border-border/70 bg-card py-0 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                <CardContent className="divide-y divide-border/60 p-0">
                  {data?.recentTransactions && data.recentTransactions.length > 0 ? (
                    data.recentTransactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/20",
                              tx.orderType === "online" ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-500"
                            )}
                          >
                            {tx.orderType === "online" ? (
                              <Smartphone className="h-4 w-4" />
                            ) : (
                              <Banknote className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-extrabold text-foreground leading-tight">{tx.driver}</p>
                            <p className="mt-1 truncate text-[10px] text-muted-foreground font-semibold flex items-center gap-1 leading-none">
                              <span>{tx.origin}</span>
                              <span className="text-[9px] text-muted-foreground/60">→</span>
                              <span>{tx.destination}</span>
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-black tracking-tight text-foreground">Rp {formatRupiah(tx.companyShare)}</p>
                          <p className="mt-1 flex items-center justify-end">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold",
                              tx.status === "lunas" 
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            )}>
                              <span className={cn("h-1 w-1 rounded-full", tx.status === "lunas" ? "bg-emerald-500" : "bg-amber-500")} />
                              {tx.status === "lunas" ? "Lunas" : "Nunggak"}
                            </span>
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

