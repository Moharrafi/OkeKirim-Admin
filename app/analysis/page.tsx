"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  Wallet,
  Wrench,
  Smartphone,
  Banknote,
  Users,
  Percent,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  Coins,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import { PullToRefresh } from "@/components/pull-to-refresh"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts"

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
  }>
  monthlyChart: Array<{ month: number; total: number; totalFare?: number; tripCount?: number }>
  driverIncome: Array<{ driver: string; total: number; trips?: number }>
  orderTypeBreakdown: Array<{ type: string; total: number; count: number }>
}

interface ServiceLog {
  id: number
  vehicle: string
  driver: string
  type: string
  date: string
  cost: number
  status: string
  hasReceipt: number
}

function formatRupiah(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

export default function AnalysisPage() {
  const router = useRouter()
  const { isAdmin, user, isAuthenticated } = useUser()
  const [data, setData] = useState<DashboardData | null>(null)
  const [services, setServices] = useState<ServiceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"trends" | "shares" | "orders" | "admin">("trends")

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (!isAdmin && user.name) {
        params.set("driver", user.name)
      }

      // Fetch dashboard data
      const dashRes = await fetch(`/api/dashboard?${params.toString()}`)
      const dashData = await dashRes.json()
      setData(dashData)

      // Fetch service logs if admin (for laba bersih calculations)
      if (isAdmin) {
        const servRes = await fetch("/api/services")
        const servData = await servRes.json()
        setServices(servData.services || [])
      }
    } catch (error) {
      console.error("Failed to fetch analysis data:", error)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, user.name])

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [fetchData, isAuthenticated])

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

  // Financial calculations
  const finances = useMemo(() => {
    if (!data) return null

    const companyShare = data.monthlyCompanyShare || 0
    const driverShare = data.monthlyDriverShare || 0
    const argoTotal = data.monthlyFare || 0
    
    const prevCompanyShare = data.lastMonthCompanyShare || 0
    const prevDriverShare = data.lastMonthDriverShare || 0
    const prevArgoTotal = data.lastMonthFare || 0

    // Admin profit = Company Share - Service Costs
    const netProfit = companyShare - (isAdmin ? serviceStats.currentMonth : 0)
    const prevNetProfit = prevCompanyShare - (isAdmin ? serviceStats.lastMonth : 0)

    // Growth percentages
    const calcGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0
      return Math.round(((curr - prev) / prev) * 100)
    }

    return {
      companyShare,
      driverShare,
      argoTotal,
      netProfit,
      prevCompanyShare,
      prevDriverShare,
      prevArgoTotal,
      prevNetProfit,
      companyGrowth: calcGrowth(companyShare, prevCompanyShare),
      driverGrowth: calcGrowth(driverShare, prevDriverShare),
      argoGrowth: calcGrowth(argoTotal, prevArgoTotal),
      netProfitGrowth: calcGrowth(netProfit, prevNetProfit)
    }
  }, [data, isAdmin, serviceStats])

  // Monthly trends chart data
  const monthlyChartData = useMemo(() => {
    if (!data) return []
    return data.monthlyChart.map(d => {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
      const monthName = monthNames[d.month - 1]
      
      const companyShareVal = d.total || 0
      const totalFareVal = d.totalFare || (companyShareVal * 2.5)
      const driverShareVal = totalFareVal - companyShareVal
      const tripCountVal = d.tripCount || 0
      const avgFareVal = tripCountVal > 0 ? Math.round(totalFareVal / tripCountVal) : 0

      return {
        month: monthName,
        monthNum: d.month,
        companyShare: companyShareVal,
        driverShare: driverShareVal,
        totalFare: totalFareVal,
        tripCount: tripCountVal,
        avgFare: avgFareVal,
        "Bagi Hasil": companyShareVal / 1000000,
        "Pendapatan Driver": driverShareVal / 1000000,
        "Total Argo": totalFareVal / 1000000,
      }
    })
  }, [data])

  const completedMonthsData = useMemo(() => {
    const currentMonthNum = new Date().getMonth() + 1
    return monthlyChartData.filter(d => d.monthNum !== currentMonthNum)
  }, [monthlyChartData])

  const bestMonth = useMemo(() => {
    if (completedMonthsData.length === 0) return null
    return [...completedMonthsData].sort((a, b) => b.totalFare - a.totalFare)[0]
  }, [completedMonthsData])

  const worstMonth = useMemo(() => {
    if (completedMonthsData.length === 0) return null
    const positiveMonths = completedMonthsData.filter(d => d.totalFare > 0)
    const list = positiveMonths.length > 0 ? positiveMonths : completedMonthsData
    return [...list].sort((a, b) => a.totalFare - b.totalFare)[0]
  }, [completedMonthsData])

  const tabs = useMemo(() => {
    const list = [
      { id: "trends", label: "Perkembangan" },
      { id: "shares", label: "Keuntungan" },
      { id: "orders", label: "Tipe Order" },
    ]
    if (isAdmin) {
      list.push({ id: "admin", label: "Ops & Driver" })
    }
    return list
  }, [isAdmin])

  const activeIndex = useMemo(() => {
    const idx = tabs.findIndex(t => t.id === activeTab)
    return idx >= 0 ? idx : 0
  }, [tabs, activeTab])

  const handleRefresh = async () => {
    await fetchData()
  }

  if (!isAuthenticated || !data || !finances) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title="Analisis Performa" showBack onBack={() => router.push("/")} />
        <div className="flex flex-col items-center justify-center py-24">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-3" />
          <p className="text-sm text-muted-foreground">Memuat data analisis...</p>
        </div>
      </div>
    )
  }

  // Order breakdown chart data
  const orderTypeData = data.orderTypeBreakdown.map((ot, idx) => ({
    name: ot.type,
    value: ot.total,
    count: ot.count,
    color: idx === 0 ? "var(--primary)" : "oklch(0.65 0.18 85)",
  }))

  const totalOrderTypeFare = orderTypeData.reduce((s, x) => s + x.value, 0)

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen pb-28">
        <MobileHeader title="Analisis Performa" showBack onBack={() => router.push("/")} />

        <main className="px-4 py-4 space-y-4">
          
          {/* Main Financial Summary Cards */}
          <div className="space-y-3">
            {isAdmin ? (
              <>
                {/* Hero Card: Laba Bersih Perusahaan */}
                <Card className={cn(
                  "border shadow-sm p-4 relative overflow-hidden rounded-2xl",
                  finances.netProfit >= 0 
                    ? "border-success/20 bg-gradient-to-br from-success/8 dark:from-success/15 via-card to-card" 
                    : "border-destructive/20 bg-gradient-to-br from-destructive/8 dark:from-destructive/15 via-card to-card"
                )}>
                  <CardContent className="p-0 space-y-4 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("p-2 rounded-xl shrink-0", finances.netProfit >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Laba Bersih Perusahaan</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Bagi hasil bersih dikurangi servis</p>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] font-semibold px-2 py-0.5", finances.netProfitGrowth >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                        {finances.netProfitGrowth >= 0 ? "+" : ""}{finances.netProfitGrowth}% MoM
                      </Badge>
                    </div>
                    <div className="flex items-baseline mt-2">
                      <span className="text-sm font-semibold text-muted-foreground mr-1.5">Rp</span>
                      <span className="text-2xl font-extrabold text-foreground tracking-tight">
                        {formatRupiah(finances.netProfit)}
                      </span>
                    </div>
                  </CardContent>
                  <TrendingUp className={cn(
                    "absolute -right-3 -bottom-3 h-24 w-24 stroke-[1] pointer-events-none opacity-10 dark:opacity-15",
                    finances.netProfit >= 0 ? "text-success" : "text-destructive"
                  )} />
                </Card>

                {/* Sub-metrics row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="border-l-[3px] border-l-primary border border-y-border border-r-border bg-card shadow-sm p-3 rounded-r-xl rounded-l-sm relative overflow-hidden flex flex-col justify-between min-h-[76px]">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Total Argo</p>
                      <p className="text-[11px] font-extrabold text-foreground mt-1 truncate">
                        Rp {formatRupiah(finances.argoTotal)}
                      </p>
                    </div>
                    <span className={cn("text-[8px] font-bold mt-1.5 block", finances.argoGrowth >= 0 ? "text-success" : "text-destructive")}>
                      {finances.argoGrowth >= 0 ? "+" : ""}{finances.argoGrowth}% MoM
                    </span>
                  </div>

                  <div className="border-l-[3px] border-l-blue-500 border border-y-border border-r-border bg-card shadow-sm p-3 rounded-r-xl rounded-l-sm relative overflow-hidden flex flex-col justify-between min-h-[76px]">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Wajib Setor</p>
                      <p className="text-[11px] font-extrabold text-foreground mt-1 truncate">
                        Rp {formatRupiah(finances.companyShare)}
                      </p>
                    </div>
                    <span className={cn("text-[8px] font-bold mt-1.5 block", finances.companyGrowth >= 0 ? "text-success" : "text-destructive")}>
                      {finances.companyGrowth >= 0 ? "+" : ""}{finances.companyGrowth}% MoM
                    </span>
                  </div>

                  <div className="border-l-[3px] border-l-amber-500 border border-y-border border-r-border bg-card shadow-sm p-3 rounded-r-xl rounded-l-sm relative overflow-hidden flex flex-col justify-between min-h-[76px]">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Biaya Servis</p>
                      <p className="text-[11px] font-extrabold text-foreground mt-1 truncate">
                        Rp {formatRupiah(serviceStats.currentMonth)}
                      </p>
                    </div>
                    <span className="text-[8px] font-medium text-muted-foreground mt-1.5 block truncate">
                      {serviceStats.lastMonth > 0 ? `Lalu: Rp ${formatRupiah(serviceStats.lastMonth)}` : "-"}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Hero Card: Pendapatan Bersih Driver */}
                <Card className="border border-primary/20 bg-gradient-to-br from-primary/8 dark:from-primary/15 via-card to-card shadow-sm p-4 relative overflow-hidden rounded-2xl">
                  <CardContent className="p-0 space-y-4 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                          <Wallet className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Pendapatan Bersih</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Porsi pendapatan driver (60%)</p>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] font-semibold px-2 py-0.5", finances.driverGrowth >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                        {finances.driverGrowth >= 0 ? "+" : ""}{finances.driverGrowth}% MoM
                      </Badge>
                    </div>
                    <div className="flex items-baseline mt-2">
                      <span className="text-sm font-semibold text-muted-foreground mr-1.5">Rp</span>
                      <span className="text-2xl font-extrabold text-foreground tracking-tight">
                        {formatRupiah(finances.driverShare)}
                      </span>
                    </div>
                  </CardContent>
                  <Wallet className="absolute -right-3 -bottom-3 h-24 w-24 text-primary/5 dark:text-primary/10 stroke-[1] pointer-events-none" />
                </Card>

                {/* Sub-metrics row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border-l-[3px] border-l-primary border border-y-border border-r-border bg-card shadow-sm p-3 rounded-r-xl rounded-l-sm relative overflow-hidden flex flex-col justify-between min-h-[76px]">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Total Argo</p>
                      <p className="text-xs font-extrabold text-foreground mt-1 truncate">
                        Rp {formatRupiah(finances.argoTotal)}
                      </p>
                    </div>
                    <span className={cn("text-[8px] font-bold mt-1.5 block", finances.argoGrowth >= 0 ? "text-success" : "text-destructive")}>
                      {finances.argoGrowth >= 0 ? "+" : ""}{finances.argoGrowth}% MoM
                    </span>
                  </div>

                  <div className="border-l-[3px] border-l-indigo-500 border border-y-border border-r-border bg-card shadow-sm p-3 rounded-r-xl rounded-l-sm relative overflow-hidden flex flex-col justify-between min-h-[76px]">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Volume Trip</p>
                      <p className="text-xs font-extrabold text-foreground mt-1">
                        {data.monthlyCount} Trip
                      </p>
                    </div>
                    <span className="text-[8px] font-medium text-muted-foreground mt-1.5 block">
                      Bulan berjalan
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="relative flex gap-1 bg-secondary/40 dark:bg-secondary/25 p-1 rounded-xl border border-border/80 overflow-hidden">
            {/* Sliding Active Tab Background */}
            <div
              className="absolute top-1 bottom-1 bg-card dark:bg-muted/85 shadow-sm rounded-lg transition-all duration-300 ease-out pointer-events-none"
              style={{
                left: `calc(${activeIndex} * ${100 / tabs.length}% + 4px)`,
                width: `calc(${100 / tabs.length}% - 8px)`,
              }}
            />
            
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "relative z-10 flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 outline-none",
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          <section className="space-y-4">
            
            {/* Trends Tab */}
            {activeTab === "trends" && (
              <div className="space-y-4 animate-fade-in">
                {/* Highlights */}
                <div className="grid grid-cols-2 gap-3">
                  {bestMonth && bestMonth.totalFare > 0 && (
                    <Card className="border-success/20 bg-success/5 dark:bg-success/10 shadow-sm relative overflow-hidden">
                      <CardContent className="p-3.5 flex items-start gap-2.5 relative z-10">
                        <div className="p-1.5 rounded-lg bg-success/15 shrink-0 mt-0.5">
                          <ArrowUpRight className="h-4 w-4 text-success" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Bulan Terbaik</p>
                          <p className="text-xs font-bold text-foreground mt-0.5">{bestMonth.month}</p>
                          <p className="text-sm font-extrabold text-success mt-0.5">Rp {formatRupiah(bestMonth.totalFare)}</p>
                        </div>
                      </CardContent>
                      <ArrowUpRight className="absolute -right-3 -bottom-3 h-16 w-16 text-success/5 dark:text-success/10 stroke-[1.5] pointer-events-none" />
                    </Card>
                  )}
                  {worstMonth && worstMonth.totalFare > 0 && (
                    <Card className="border-destructive/20 bg-destructive/5 dark:bg-destructive/10 shadow-sm relative overflow-hidden">
                      <CardContent className="p-3.5 flex items-start gap-2.5 relative z-10">
                        <div className="p-1.5 rounded-lg bg-destructive/15 shrink-0 mt-0.5">
                          <ArrowDownRight className="h-4 w-4 text-destructive" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Bulan Terendah</p>
                          <p className="text-xs font-bold text-foreground mt-0.5">{worstMonth.month}</p>
                          <p className="text-sm font-extrabold text-destructive mt-0.5">Rp {formatRupiah(worstMonth.totalFare)}</p>
                        </div>
                      </CardContent>
                      <ArrowDownRight className="absolute -right-3 -bottom-3 h-16 w-16 text-destructive/5 dark:text-destructive/10 stroke-[1.5] pointer-events-none" />
                    </Card>
                  )}
                </div>

                {/* Monthly Earnings Chart */}
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Tren Pendapatan Bulanan</h4>
                      <p className="text-[11px] text-muted-foreground">Progresi pembagian hasil bulanan dalam Juta Rupiah</p>
                    </div>

                    <div className="h-56 w-full" role="img" aria-label="Grafik tren bulanan">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyChartData} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                          <defs>
                            <linearGradient id="colorBagiHasil" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorDriver" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="oklch(0.65 0.18 85)" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="oklch(0.65 0.18 85)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}Jt`} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: number) => [`Rp ${value.toFixed(1)} Jt`, '']}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                          <Area type="monotone" dataKey="Bagi Hasil" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorBagiHasil)" />
                          <Area type="monotone" dataKey="Pendapatan Driver" stroke="oklch(0.65 0.18 85)" strokeWidth={2} fillOpacity={1} fill="url(#colorDriver)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Trip Volume Trend */}
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Tren Volume Trip Bulanan</h4>
                      <p className="text-[11px] text-muted-foreground">Jumlah orderan yang diselesaikan dari bulan ke bulan</p>
                    </div>

                    <div className="h-44 w-full" role="img" aria-label="Grafik volume trip bulanan">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyChartData} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: number) => [`${value} Trip`, 'Volume']}
                          />
                          <Bar dataKey="tripCount" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Average Fare Trend */}
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Tren Rata-rata Argo per Trip</h4>
                      <p className="text-[11px] text-muted-foreground">Rata-rata nilai argo yang diperoleh per trip</p>
                    </div>

                    <div className="h-44 w-full" role="img" aria-label="Grafik argo rata-rata">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyChartData} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                          <defs>
                            <linearGradient id="colorAvgFare" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="oklch(0.7 0.16 120)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="oklch(0.7 0.16 120)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `Rp ${formatRupiah(Math.round(v))}`} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: number) => [`Rp ${formatRupiah(Math.round(value))}`, 'Rata-rata']}
                          />
                          <Area type="monotone" dataKey="avgFare" stroke="oklch(0.7 0.16 120)" strokeWidth={2} fillOpacity={1} fill="url(#colorAvgFare)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Historical Data Table */}
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Tabel Data Historis</h4>
                      <p className="text-[11px] text-muted-foreground">Rincian angka performa riil dari bulan ke bulan</p>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-border bg-card">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-secondary/40 border-b border-border text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                            <th className="py-2.5 px-3">Bulan</th>
                            <th className="py-2.5 px-3 text-right">Trip</th>
                            <th className="py-2.5 px-3 text-right">Total Argo</th>
                            <th className="py-2.5 px-3 text-right">{isAdmin ? "Bagi Hasil" : "Pendapatan"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {monthlyChartData.map((row) => (
                            <tr key={row.month} className="hover:bg-secondary/10 transition-colors">
                              <td className="py-2 px-3 font-medium text-foreground">{row.month}</td>
                              <td className="py-2 px-3 text-right text-muted-foreground">{row.tripCount}</td>
                              <td className="py-2 px-3 text-right text-foreground font-semibold">Rp {formatRupiah(row.totalFare)}</td>
                              <td className="py-2 px-3 text-right text-primary font-bold">
                                Rp {formatRupiah(isAdmin ? row.companyShare : row.driverShare)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Analysis Box */}
                <div className="rounded-xl border border-border bg-secondary/20 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Info className="h-4 w-4 text-primary" />
                    <span>Analisis Pertumbuhan Bulanan</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Total argo Anda bulan ini adalah <b>Rp {formatRupiah(finances.argoTotal)}</b>, mengalami 
                    {finances.argoGrowth >= 0 ? (
                      <span className="text-success font-semibold"> kenaikan sebanyak {finances.argoGrowth}% </span>
                    ) : (
                      <span className="text-destructive font-semibold"> penurunan sebanyak {Math.abs(finances.argoGrowth)}% </span>
                    )} 
                    dibandingkan bulan lalu (Rp {formatRupiah(finances.prevArgoTotal)}).
                  </p>
                </div>
              </div>
            )}

            {/* Shares Tab */}
            {activeTab === "shares" && (
              <Card className="border-border bg-card">
                <CardContent className="p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Analisis Profitabilitas & Kontribusi</h4>
                    <p className="text-[11px] text-muted-foreground">Pembagian keuntungan dari argo (40% Perusahaan / 60% Driver)</p>
                  </div>

                  {/* Progress bars illustrating the division of share */}
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-foreground">Bagian Perusahaan (40%)</span>
                        <span className="font-bold text-primary">Rp {formatRupiah(finances.companyShare)}</span>
                      </div>
                      <div className="h-3 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: "40%" }} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-foreground">Bagian Driver (60%)</span>
                        <span className="font-bold text-success">Rp {formatRupiah(finances.driverShare)}</span>
                      </div>
                      <div className="h-3 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: "60%" }} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="rounded-xl border border-border bg-secondary/15 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Rata-rata Margin</p>
                      <p className="text-lg font-extrabold text-foreground mt-1">40.0%</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Wajib Setor Tetap</p>
                    </div>
                    <div className="rounded-xl border border-border bg-secondary/15 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Estimasi Driver Take-home</p>
                      <p className="text-lg font-extrabold text-foreground mt-1">60.0%</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Pendapatan Driver</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Orders Tab */}
            {activeTab === "orders" && (
              <Card className="border-border bg-card">
                <CardContent className="p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Pembagian Tipe Order</h4>
                    <p className="text-[11px] text-muted-foreground">Perbandingan transaksi dari Order Online vs Offline</p>
                  </div>

                  {totalOrderTypeFare > 0 ? (
                    <div className="flex items-center justify-between gap-6 py-2">
                      <div className="h-36 w-36 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={orderTypeData}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={50}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {orderTypeData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: number) => [`Rp ${formatRupiah(value)}`, '']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        {orderTypeData.map((ot) => {
                          const percentage = totalOrderTypeFare > 0 ? Math.round((ot.value / totalOrderTypeFare) * 100) : 0
                          return (
                            <div key={ot.name} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ot.color }} />
                                  <span className="font-semibold text-foreground">{ot.name}</span>
                                </div>
                                <span className="font-bold text-foreground">{percentage}%</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground pl-4">
                                Rp {formatRupiah(ot.value)} • {ot.count} trip
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      Tidak ada data tipe order untuk periode ini
                    </div>
                  )}

                  <div className="border-t border-border pt-4 grid grid-cols-2 gap-4">
                    {orderTypeData.map((ot) => {
                      const avgFare = ot.count > 0 ? Math.round(ot.value / ot.count) : 0
                      return (
                        <div key={ot.name} className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground">{ot.name} Avg. Argo / Trip</p>
                          <p className="text-sm font-bold text-foreground">Rp {formatRupiah(avgFare)}</p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Admin Leaderboard & Service Tab */}
            {activeTab === "admin" && isAdmin && (
              <div className="space-y-4">
                
                {/* Driver Rankings Leaderboard */}
                <Card className="border-border bg-card">
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Peringkat Kontribusi Setoran Driver</h4>
                      <p className="text-[11px] text-muted-foreground">Supir dengan setoran wajib terbesar bulan ini</p>
                    </div>

                    <div className="divide-y divide-border">
                      {data.driverIncome && data.driverIncome.length > 0 ? (
                        data.driverIncome.map((driver, index) => {
                          const driverTotal = driver.total || 0
                          const driverTrips = driver.trips || 0
                          const rankColor = index === 0 ? "text-amber-500" : index === 1 ? "text-gray-400" : index === 2 ? "text-amber-700" : "text-muted-foreground"
                          
                          return (
                            <div key={driver.driver} className="flex items-center justify-between py-2.5 gap-3">
                              <div className="flex items-center gap-3">
                                <span className={cn("text-xs font-bold w-4 text-center", rankColor)}>
                                  {index + 1}
                                </span>
                                <div>
                                  <p className="text-xs font-semibold text-foreground">{driver.driver}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{driverTrips} trip selesai</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-foreground">Rp {formatRupiah(driverTotal)}</p>
                                <p className="text-[9px] text-muted-foreground mt-0.5">Setoran (40%)</p>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-muted-foreground">Belum ada data kontribusi supir</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Service Logs summary */}
                <Card className="border-border bg-card">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">Log Pengeluaran Servis Kendaraan</h4>
                        <p className="text-[11px] text-muted-foreground">Histori biaya perawatan kendaraan operasional</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-primary flex items-center gap-0.5 px-2"
                        onClick={() => router.push("/service")}
                      >
                        Detail
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="divide-y divide-border">
                      {services && services.length > 0 ? (
                        services.slice(0, 4).map((s) => {
                          const dateObj = new Date(s.date)
                          const formattedDate = !Number.isNaN(dateObj.getTime())
                            ? dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "short" })
                            : s.date
                          return (
                            <div key={s.id} className="flex items-center justify-between py-2.5">
                              <div>
                                <p className="text-xs font-semibold text-foreground">{s.vehicle}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {s.driver} • {s.type} • {formattedDate}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-destructive">Rp {formatRupiah(s.cost)}</p>
                                <Badge className={cn(
                                  "text-[8px] px-1 py-0 mt-0.5",
                                  s.status === "selesai" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                                )}>
                                  {s.status}
                                </Badge>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-muted-foreground">Belum ada pengeluaran servis</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

              </div>
            )}
          </section>

        </main>
      </div>
    </PullToRefresh>
  )
}
