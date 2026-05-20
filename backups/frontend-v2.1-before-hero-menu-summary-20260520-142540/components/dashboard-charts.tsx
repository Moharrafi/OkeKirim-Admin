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

interface DashboardChartsProps {
  monthlyChart: Array<{ month: number; total: number }>
  driverIncome: Array<{ driver: string; total: number }>
  orderTypeBreakdown: Array<{ type: string; total: number; count: number }>
  isAdmin: boolean
  formatRupiah: (amount: number) => string
}

export default function DashboardCharts({
  monthlyChart,
  driverIncome,
  orderTypeBreakdown,
  isAdmin,
  formatRupiah,
}: DashboardChartsProps) {
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

      {/* Pie Chart */}
      {((driverIncome && driverIncome.length > 0) || (orderTypeBreakdown && orderTypeBreakdown.length > 0)) && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">
              {isAdmin ? "Setoran per Driver" : "Berdasarkan Tipe Order"}
            </h3>
            {(() => {
              const pieData = isAdmin
                ? driverIncome.map((d, i) => ({
                    name: d.driver,
                    value: d.total,
                    color: ["#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#6b7280"][i % 5],
                  }))
                : (orderTypeBreakdown || []).map((d, i) => ({
                    name: d.type,
                    value: d.total,
                    color: ["#14b8a6", "#f59e0b"][i % 2],
                  }))
              const totalAll = pieData.reduce((s, x) => s + x.value, 0)
              if (totalAll === 0) return null
              return (
                <div className="flex items-center gap-4" role="img" aria-label={isAdmin ? "Grafik setoran per driver" : "Grafik berdasarkan tipe order"}>
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
      )}
    </>
  )
}
