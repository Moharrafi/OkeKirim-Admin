"use client"

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
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, TrendingUp, Medal, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardChartsProps {
  monthlyChart: Array<{ month: number; total: number }>
  driverIncome: Array<{ driver: string; total: number; trips?: number }>
  orderTypeBreakdown: Array<{ type: string; total: number; count: number }>
  isAdmin: boolean
  formatRupiah: (amount: number) => string
  currentDriver?: string
  driverChartMonth?: string
}

function DriverRankingCard({
  driverIncome,
  currentDriver,
  formatRupiah,
}: {
  driverIncome: Array<{ driver: string; total: number; trips?: number }>
  currentDriver: string
  formatRupiah: (amount: number) => string
}) {
  if (!driverIncome || driverIncome.length === 0) return null

  // Find current driver's position
  const sortedDrivers = [...driverIncome].sort((a, b) => b.total - a.total)
  const currentIndex = sortedDrivers.findIndex(
    d => d.driver.toLowerCase() === currentDriver.toLowerCase()
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
  const percentOfTop = topDriver.total > 0 
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

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-0">
        {/* Header with rank */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Peringkat Kamu</h3>
            <div className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full", rankBg)}>
              {rank <= 3 ? <Medal className={cn("h-3.5 w-3.5", rankColor)} /> : <Trophy className={cn("h-3.5 w-3.5", rankColor)} />}
              <span className={cn("text-xs font-bold", rankColor)}>#{rank}</span>
              <span className="text-[10px] text-muted-foreground">/ {totalDrivers}</span>
            </div>
          </div>
        </div>

        {/* Main stats */}
        <div className="px-4 pb-4">
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

          {/* Progress bar relative to top */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">
                {percentOfTop}% dari driver teratas
              </span>
              {rank > 1 && (
                <span className="text-[10px] text-muted-foreground">
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

        {/* Mini leaderboard (top 3 + current if not in top 3) */}
        <div className="border-t border-border/60 px-4 py-3 bg-secondary/20">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Leaderboard</p>
          <div className="space-y-1.5">
            {sortedDrivers.map((d, i) => {
              const isMe = d.driver.toLowerCase() === currentDriver.toLowerCase()
              return (
                <div key={d.driver} className={cn(
                  "flex items-center justify-between py-1 px-2 rounded-lg",
                  isMe && "bg-primary/10"
                )}>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold w-4",
                      i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"
                    )}>
                      {i + 1}.
                    </span>
                    <span className={cn("text-xs", isMe ? "font-bold text-primary" : "text-foreground")}>
                      {isMe ? "Kamu" : d.driver}
                    </span>
                  </div>
                  <span className={cn("text-[10px] font-medium", isMe ? "text-primary" : "text-muted-foreground")}>
                    Rp {formatRupiah(d.total)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
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
}: DashboardChartsProps) {
  const driverChartMonthLabel = driverChartMonth
    ? new Date(`${driverChartMonth}T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    : ""

  return (
    <>
      {/* Monthly Chart */}
      {monthlyChart && monthlyChart.length > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">Pendapatan Bulanan</h3>
            <div className="h-48" role="img" aria-label="Grafik pendapatan bulanan">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyChart.map(d => ({
                    month: ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][d.month - 1],
                    total: d.total / 1000000,
                  }))}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}Jt`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [`Rp ${value.toFixed(1)} Juta`, 'Setoran']}
                  />
                  <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
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
