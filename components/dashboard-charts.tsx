"use client"

import { useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, TrendingUp, Medal, Zap, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface DashboardChartsProps {
  monthlyChart: Array<{ month: number; total: number; totalFare?: number; tripCount?: number }>
  driverIncome: Array<{ driver: string; total: number; trips?: number; vehicleType?: string; rankTrend?: number | 'new' }>
  orderTypeBreakdown: Array<{ type: string; total: number; count: number }>
  isAdmin: boolean
  formatRupiah: (amount: number) => string
  currentDriver?: string
  driverChartMonth?: string
  driverVehicleType?: string
  topDriverInsight?: string
}

function DriverRankingCard({
  driverIncome,
  currentDriver,
  formatRupiah,
  driverVehicleType,
  topDriverInsight,
}: {
  driverIncome: Array<{ driver: string; total: number; trips?: number; vehicleType?: string; rankTrend?: number | 'new' }>
  currentDriver: string
  formatRupiah: (amount: number) => string
  driverVehicleType?: string
  topDriverInsight?: string
}) {
  const [vehicleFilter, setVehicleFilter] = useState<"all" | "same">("all")

  if (!driverIncome || driverIncome.length === 0) return null

  // Normalise names and find vehicleType of current driver if not provided
  const normalizedCurrentDriver = currentDriver.trim().toLowerCase()
  const detectedUserVehicleType = driverVehicleType || 
    driverIncome.find(d => d.driver.trim().toLowerCase() === normalizedCurrentDriver)?.vehicleType || 
    "CDE"

  // Filter list based on selected tab
  const filteredDrivers = driverIncome.filter(d => {
    if (vehicleFilter === "same") {
      return (d.vehicleType || "CDE").trim().toUpperCase() === detectedUserVehicleType.trim().toUpperCase()
    }
    return true
  })

  // Find current driver's position in the (filtered) list
  const sortedDrivers = [...filteredDrivers].sort((a, b) => b.total - a.total)
  const currentIndex = sortedDrivers.findIndex(
    d => d.driver.trim().toLowerCase() === normalizedCurrentDriver
  )
  const currentData = currentIndex >= 0 ? sortedDrivers[currentIndex] : null
  const rank = currentIndex + 1
  const totalDrivers = sortedDrivers.length
  const topDriver = sortedDrivers[0]
  const totalAll = sortedDrivers.reduce((sum, d) => sum + d.total, 0)

  if (!currentData) return null

  // Calculate percentile (how many drivers you beat)
  const percentile = totalDrivers > 1 
    ? Math.round(((totalDrivers - rank) / (totalDrivers - 1)) * 100)
    : 100
  
  // Percentage of top driver's income
  const percentOfTop = topDriver && topDriver.total > 0 
    ? Math.round((currentData.total / topDriver.total) * 100)
    : 0

  // Percentage contribution to total
  const contribution = totalAll > 0
    ? Math.round((currentData.total / totalAll) * 100)
    : 0

  // Progress bar width (relative to top driver)
  const progressWidth = Math.max(5, percentOfTop)

  // Rank badge color
  const rankColor = rank === 1 ? "text-amber-500" : rank === 2 ? "text-gray-400" : rank === 3 ? "text-amber-700" : "text-muted-foreground"
  const rankBg = rank === 1 ? "bg-amber-500/10" : rank === 2 ? "bg-gray-400/10" : rank === 3 ? "bg-amber-700/10" : "bg-muted"

  // Point 1: Realistic Rank Target (Nudge)
  let targetNudgeText = ""
  if (currentIndex > 0) {
    const targetDriver = sortedDrivers[currentIndex - 1]
    const diff = targetDriver.total - currentData.total
    const currentAvg = currentData.trips && currentData.trips > 0 ? currentData.total / currentData.trips : 200000
    const tripsNeeded = Math.ceil(diff / currentAvg)
    targetNudgeText = `Kamu hanya butuh Rp ${formatRupiah(diff)} lagi (~${tripsNeeded} trip) untuk menyalip ${targetDriver.driver} di peringkat #${currentIndex}!`
  } else if (currentIndex === 0) {
    targetNudgeText = "Luar biasa! Kamu memimpin di peringkat teratas kategori ini. Pertahankan! 🏆"
  }

  // Point 2: Leaderboard Badges helper
  let maxTrips = 0
  let maxTripsDriver = ""
  let maxAvg = 0
  let maxAvgDriver = ""

  sortedDrivers.forEach(d => {
    if (d.trips && d.trips > maxTrips) {
      maxTrips = d.trips
      maxTripsDriver = d.driver
    }
    const avg = d.trips && d.trips > 0 ? d.total / d.trips : 0
    if (avg > maxAvg) {
      maxAvg = avg
      maxAvgDriver = d.driver
    }
  })

  const getBadges = (driverName: string, isRank1: boolean, tripsCount: number, totalAmount: number) => {
    const list: Array<{ label: string; style: string }> = []
    if (isRank1) {
      list.push({ label: "🏆 Juara 1", style: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" })
    }
    if (driverName === maxTripsDriver && tripsCount > 0) {
      list.push({ label: "⚡ Pejuang Rit", style: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" })
    }
    if (driverName === maxAvgDriver && totalAmount > 0) {
      list.push({ label: "💎 Jawara Cargo", style: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20" })
    }
    if (list.length === 0 && tripsCount >= 5) {
      list.push({ label: "✅ Konsisten", style: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" })
    }
    return list
  }

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-0">
        {/* Header with rank & switcher */}
        <div className="px-4 pt-4 pb-3 border-b border-border/50 bg-secondary/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Peringkat & Kompetisi</h3>
            <div className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full", rankBg)}>
              {rank <= 3 ? <Medal className={cn("h-3.5 w-3.5", rankColor)} /> : <Trophy className={cn("h-3.5 w-3.5", rankColor)} />}
              <span className={cn("text-xs font-bold", rankColor)}>#{rank}</span>
              <span className="text-[10px] text-muted-foreground">/ {totalDrivers}</span>
            </div>
          </div>
          
          {/* Point 4: Category Filter Tab */}
          <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-secondary/50 border border-border/60">
            <button
              onClick={() => setVehicleFilter("all")}
              className={cn(
                "text-[10px] font-extrabold py-1.5 rounded-md transition-all",
                vehicleFilter === "all"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Semua Armada
            </button>
            <button
              onClick={() => setVehicleFilter("same")}
              className={cn(
                "text-[10px] font-extrabold py-1.5 rounded-md transition-all",
                vehicleFilter === "same"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Armada Sejenis ({detectedUserVehicleType})
            </button>
          </div>
        </div>

        {/* Main stats */}
        <div className="px-4 py-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-foreground tracking-tight">
                Rp {formatRupiah(currentData.total)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Setoran bulan ini · {currentData.trips || 0} trip
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-primary">{percentile}%</p>
              <p className="text-[10px] text-muted-foreground">lebih tinggi</p>
            </div>
          </div>

          {/* Point 1: Target Nudge Box */}
          {targetNudgeText && (
            <div className="mb-4 p-2 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 text-center">
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 leading-tight">
                {targetNudgeText}
              </p>
            </div>
          )}

          {/* Progress bar relative to top */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">
                {percentOfTop}% dari driver teratas
              </span>
              {rank > 1 && topDriver && (
                <span className="text-[10px] text-muted-foreground font-semibold text-primary">
                  Selisih Rp {formatRupiah(topDriver.total - currentData.total)}
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  rank === 1 ? "bg-amber-500" : rank <= 3 ? "bg-primary" : "bg-primary/70"
                )}
                style={{ width: `${progressWidth}%` }}
              />
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-secondary/50 p-2 text-center">
              <Zap className="h-3.5 w-3.5 text-amber-500 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-foreground">{currentData.trips || 0}</p>
              <p className="text-[9px] text-muted-foreground">Trip</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2 text-center">
              <TrendingUp className="h-3.5 w-3.5 text-primary mx-auto mb-0.5" />
              <p className="text-xs font-bold text-foreground">{contribution}%</p>
              <p className="text-[9px] text-muted-foreground">Kontribusi</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2 text-center">
              <Trophy className="h-3.5 w-3.5 text-amber-500 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-foreground">#{rank}</p>
              <p className="text-[9px] text-muted-foreground">Ranking</p>
            </div>
          </div>
        </div>

        {/* Mini leaderboard with badges, trends, and details */}
        <div className="border-t border-border/60 px-4 py-3 bg-secondary/20">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Leaderboard</p>
          <div className="space-y-2">
            {sortedDrivers.map((d, i) => {
              const isMe = d.driver.trim().toLowerCase() === currentDriver.trim().toLowerCase()
              return (
                <div key={d.driver} className={cn(
                  "flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors",
                  isMe && "bg-primary/10 border border-primary/20"
                )}>
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank number + trend (Point 6) */}
                    <div className="flex items-center gap-1 shrink-0 min-w-[28px]">
                      <span className={cn(
                        "text-[11px] font-extrabold",
                        i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"
                      )}>
                        {i + 1}.
                      </span>
                      {d.rankTrend === "new" ? (
                        <span className="text-[7px] font-black text-blue-500 bg-blue-500/10 px-0.5 rounded border border-blue-500/10 leading-none scale-90" title="Driver Baru">N</span>
                      ) : d.rankTrend && d.rankTrend > 0 ? (
                        <span className="text-[8px] text-emerald-500 font-black leading-none" title={`Naik ${d.rankTrend} peringkat`}>▲</span>
                      ) : d.rankTrend && d.rankTrend < 0 ? (
                        <span className="text-[8px] text-red-500 font-black leading-none" title={`Turun ${Math.abs(d.rankTrend)} peringkat`}>▼</span>
                      ) : (
                        <span className="text-[8px] text-muted-foreground opacity-30 leading-none">•</span>
                      )}
                    </div>

                    {/* Driver details + Badges (Point 2) */}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("text-xs leading-none", isMe ? "font-bold text-primary" : "text-foreground font-medium")}>
                          {isMe ? "Kamu" : d.driver}
                        </span>
                        {getBadges(d.driver, i === 0, d.trips || 0, d.total).map((b, bIdx) => (
                          <span key={bIdx} className={cn("text-[7px] font-extrabold px-1 py-0.2 rounded-full leading-none tracking-tight shrink-0", b.style)}>
                            {b.label}
                          </span>
                        ))}
                      </div>
                      <p className="text-[8px] text-muted-foreground font-medium leading-none mt-0.5">
                        {d.trips || 0} trip · {d.vehicleType || "CDE"}
                      </p>
                    </div>
                  </div>

                  <span className={cn("text-[10px] font-bold shrink-0 tabular-nums", isMe ? "text-primary" : "text-foreground")}>
                    Rp {formatRupiah(d.total)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Driver Insights Card (Point 5) */}
        {topDriverInsight && (
          <div className="border-t border-border/50 bg-amber-500/5 px-4 py-3.5 flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-wider leading-none">Wawasan Driver Teratas</p>
              <p className="text-[10px] text-amber-700/90 dark:text-amber-400/95 font-medium mt-1 leading-normal">
                {topDriverInsight}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardCharts({
  monthlyChart,
  driverIncome,
  orderTypeBreakdown,
  isAdmin,
  formatRupiah,
  currentDriver,
  driverChartMonth,
  driverVehicleType,
  topDriverInsight,
}: DashboardChartsProps) {
  const [chartTab, setChartTab] = useState<"deposit" | "fare" | "trips">("deposit")
  const driverChartMonthLabel = driverChartMonth
    ? new Date(`${driverChartMonth}T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    : ""

  return (
    <>
      {/* Monthly Chart */}
      {monthlyChart && monthlyChart.length > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground tracking-tight">Analisis Bulanan</h3>
                <Link href="/analysis" className="text-xs font-semibold text-primary flex items-center gap-0.5 hover:underline">
                  Lihat Analisis
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Interactive Tabs */}
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-secondary/50">
                <button
                  onClick={() => setChartTab("deposit")}
                  className={cn(
                    "text-[11px] font-semibold py-1.5 px-2 rounded-md transition-all",
                    chartTab === "deposit"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Setoran
                </button>
                <button
                  onClick={() => setChartTab("fare")}
                  className={cn(
                    "text-[11px] font-semibold py-1.5 px-2 rounded-md transition-all",
                    chartTab === "fare"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Argo Trip
                </button>
                <button
                  onClick={() => setChartTab("trips")}
                  className={cn(
                    "text-[11px] font-semibold py-1.5 px-2 rounded-md transition-all",
                    chartTab === "trips"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Trip
                </button>
              </div>
            </div>

            <div className="h-48" role="img" aria-label="Grafik data bulanan">
              <ResponsiveContainer width="100%" height="100%">
                {chartTab === "deposit" ? (
                  <AreaChart
                    data={monthlyChart.map(d => ({
                      month: ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][d.month - 1],
                      total: d.total / 1000000,
                    }))}
                    margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorDeposit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}Jt`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number) => [`Rp ${value.toFixed(1)} Juta`, 'Total Setoran']}
                    />
                    <Area type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorDeposit)" />
                  </AreaChart>
                ) : chartTab === "fare" ? (
                  <AreaChart
                    data={monthlyChart.map(d => ({
                      month: ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][d.month - 1],
                      fare: (d.totalFare || 0) / 1000000,
                    }))}
                    margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorFare" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}Jt`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number) => [`Rp ${value.toFixed(1)} Juta`, 'Total Argo']}
                    />
                    <Area type="monotone" dataKey="fare" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorFare)" />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={monthlyChart.map(d => ({
                      month: ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][d.month - 1],
                      trips: d.tripCount || 0,
                    }))}
                    margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                  >
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number) => [`${value} Trip`, 'Volume Trip']}
                    />
                    <Bar dataKey="trips" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Driver Ranking (for driver view) or Pie Chart (for admin view) */}
      {!isAdmin && currentDriver && driverIncome && driverIncome.length > 0 ? (
        <DriverRankingCard
          driverIncome={driverIncome}
          currentDriver={currentDriver}
          formatRupiah={formatRupiah}
          driverVehicleType={driverVehicleType}
          topDriverInsight={topDriverInsight}
        />
      ) : isAdmin && ((driverIncome && driverIncome.length > 0) || (orderTypeBreakdown && orderTypeBreakdown.length > 0)) ? (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">
              Setoran per Driver{driverChartMonthLabel ? ` (${driverChartMonthLabel})` : ""}
            </h3>
            {(() => {
              const pieData = driverIncome.slice(0, 5).map((d, i) => ({
                name: d.driver,
                value: d.total,
                color: ["#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#6b7280"][i % 5],
              }))
              const totalAll = pieData.reduce((s, x) => s + x.value, 0)
              if (totalAll === 0) return null
              return (
                <div className="flex items-center gap-4" role="img" aria-label="Grafik setoran per driver">
                  <div className="h-36 w-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={55}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(value: number) => [`Rp ${formatRupiah(value)}`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {pieData.map((d, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} aria-hidden="true" />
                          <span className="text-xs text-muted-foreground">{d.name}</span>
                        </div>
                        <span className="text-xs font-medium text-foreground">
                          {totalAll > 0 ? Math.round((d.value / totalAll) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
