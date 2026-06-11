"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Smartphone,
  Banknote,
  ChevronRight,
  X,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import { fetchHistoryPage, fetchDrivers, type Schedule, type Driver } from "@/lib/okekirim-api"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { useDebounce } from "@/hooks/use-debounce"

const HISTORY_CHUNK_DAYS = 3

const getStatusConfig = (status: string, isDriver: boolean = false) => {
  switch (status) {
    case "success":
      return { label: isDriver ? "Disetor" : "Berhasil", color: "bg-success/10 text-success" }
    case "pending":
      return { label: isDriver ? "Belum Setor" : "Pending", color: "bg-warning/10 text-warning" }
    case "failed":
      return { label: "Gagal", color: "bg-destructive/10 text-destructive" }
    default:
      return { label: "Unknown", color: "bg-muted text-muted-foreground" }
  }
}

type HistoryTransaction = {
  id: string
  date: string
  time: string
  driver: string
  vehicle: string
  route: string
  argo: number
  amount: number
  type: string
  method: string
  status: string
}

function addDaysToDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function dedupeTransactions(items: HistoryTransaction[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function mapScheduleToTransaction(s: Schedule, status: "success" | "pending"): HistoryTransaction {
  const paidDate = s.paidOffAt || s.lastPaidAt || s.date
  const fullAmount = s.companyShare || Math.round((s.fare || 0) * 0.4)
  const remainingAmount = Math.max(fullAmount - (s.paidCompanyAmount || 0), 0)

  return {
    id: `TRX-${String(s.id).padStart(3, "0")}`,
    date: paidDate
      ? new Date(paidDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      : "-",
    time: paidDate
      ? new Date(paidDate).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
      : "",
    driver: s.driver || "Unknown",
    vehicle: s.vehicle || s.driverVehicle || "-",
    route: `${s.origin || "-"} → ${s.destination || "-"}`,
    argo: s.fare || 0,
    amount: status === "success" ? fullAmount : remainingAmount,
    type: s.orderType === "offline" ? "offline" : "online",
    method: status === "success" ? (s.payment_notes || s.paymentNotes || "Lunas") : (s.payment_notes || s.paymentNotes || "Belum Setor"),
    status,
  }
}

export default function HistoryPage() {
  const router = useRouter()
  const { isAdmin, isDriver, user, isAuthenticated } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<string>("all")
  
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  const [selectedTx, setSelectedTx] = useState<HistoryTransaction | null>(null)
  const [apiTransactions, setApiTransactions] = useState<HistoryTransaction[]>([])
  const [loadingApi, setLoadingApi] = useState(false)
  const [apiDrivers, setApiDrivers] = useState<Driver[]>([])
  const [filterDriver, setFilterDriver] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [loadingMoreApi, setLoadingMoreApi] = useState(false)
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false)
  const [nextChunkTo, setNextChunkTo] = useState<string | null>(null)

  useEffect(() => {
    fetchDrivers().then(setApiDrivers).catch(() => {})
  }, [])

  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const fetchTransactions = useCallback(async () => {
    setLoadingApi(true)
    setApiTransactions([])
    setHasMoreTransactions(false)
    setNextChunkTo(null)
    const driverName = isDriver ? user.name : (filterDriver || undefined)
    try {
      const response = await fetchHistoryPage(driverName, undefined, filterDateTo || undefined, {
        includePending: true,
        minDate: filterDateFrom || undefined,
        windowDays: HISTORY_CHUNK_DAYS,
      })
      const mapped = response.history.map((schedule) =>
        mapScheduleToTransaction(schedule, schedule.status === "lunas" ? "success" : "pending")
      )
      setApiTransactions(mapped)
      setHasMoreTransactions(response.hasMore)
      setNextChunkTo(response.hasMore && response.range?.from
        ? addDaysToDateString(response.range.from, -1)
        : null)
    } catch {
      setApiTransactions([])
      setHasMoreTransactions(false)
      setNextChunkTo(null)
    } finally {
      setLoadingApi(false)
    }
  }, [filterDateFrom, filterDateTo, filterDriver, isDriver, user.name])

  const loadMoreTransactions = useCallback(async () => {
    if (!nextChunkTo || loadingMoreApi) return

    setLoadingMoreApi(true)
    const driverName = isDriver ? user.name : (filterDriver || undefined)
    try {
      const response = await fetchHistoryPage(driverName, undefined, nextChunkTo, {
        includePending: true,
        minDate: filterDateFrom || undefined,
        windowDays: HISTORY_CHUNK_DAYS,
      })
      const mapped = response.history.map((schedule) =>
        mapScheduleToTransaction(schedule, schedule.status === "lunas" ? "success" : "pending")
      )

      setApiTransactions((current) => dedupeTransactions([...current, ...mapped]))
      setHasMoreTransactions(response.hasMore)
      setNextChunkTo(response.hasMore && response.range?.from
        ? addDaysToDateString(response.range.from, -1)
        : null)
    } catch {
      setHasMoreTransactions(false)
    } finally {
      setLoadingMoreApi(false)
    }
  }, [filterDateFrom, filterDriver, isDriver, loadingMoreApi, nextChunkTo, user.name])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const transactions = apiTransactions
  const summaryCounts = useMemo(() => {
    return {
      totalTrips: transactions.length,
      lunasCount: transactions.filter((tx) => tx.status === "success").length,
      nunggakCount: transactions.filter((tx) => tx.status === "pending").length,
    }
  }, [transactions])

  const activeDrivers = useMemo(() => {
    return apiDrivers.filter((driver) => (driver.status || "").trim().toLowerCase() === "aktif")
  }, [apiDrivers])

  const filteredTransactions = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase().trim()
    return transactions.filter((tx) => {
      const matchesSearch = isDriver
        ? tx.route.toLowerCase().includes(query) ||
          tx.id.toLowerCase().includes(query)
        : tx.driver.toLowerCase().includes(query) ||
          tx.id.toLowerCase().includes(query)
      const matchesFilter = activeFilter === "all" || tx.status === activeFilter
      return matchesSearch && matchesFilter
    })
  }, [transactions, isDriver, debouncedSearchQuery, activeFilter])

  const totalAmount = useMemo(() => {
    return transactions
      .filter((tx) => tx.status === "success")
      .reduce((sum, tx) => sum + tx.amount, 0)
  }, [transactions])

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce((groups, tx) => {
      const date = tx.date
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(tx)
      return groups
    }, {} as Record<string, typeof transactions>)
  }, [filteredTransactions])

  const renderedList = useMemo(() => {
    return (
      <>
        {Object.entries(groupedTransactions).map(([date, txs]) => (
          <div key={date}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {date}
            </p>
            <Card className="border-border bg-card">
              <CardContent className="p-0 divide-y divide-border">
                {txs.map((tx) => {
                  const statusConfig = getStatusConfig(tx.status, isDriver)
                  return (
                    <button
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="w-full flex items-center justify-between p-3 text-left active:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2.5 rounded-xl",
                          tx.type === "online" ? "bg-primary/10" : "bg-chart-3/10"
                        )}>
                          {tx.type === "online" ? (
                            <Smartphone className="h-4 w-4 text-primary" />
                          ) : (
                            <Banknote className="h-4 w-4 text-chart-3" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {tx.driver}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {tx.route}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {tx.method} • {tx.time}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <p className={cn(
                            "font-semibold text-sm",
                            tx.status === "success" ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {tx.status === "failed" ? "-" : isDriver ? "" : "+"}Rp {tx.amount.toLocaleString("id-ID")}
                          </p>
                          <Badge className={cn("text-[10px] px-1.5 py-0", statusConfig.color)}>
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        ))}
      </>
    )
  }, [groupedTransactions, isDriver])

  if (!isAuthenticated) {
    return null
  }

  return (
    <PullToRefresh onRefresh={fetchTransactions}>
    <div className="min-h-screen pb-24">
      <MobileHeader title="Riwayat" />
      
      <div className="px-4 py-4 space-y-4">
        {/* Summary - Compact */}
        <Card className="bg-primary/10 dark:bg-primary/15 border-primary/20 overflow-hidden relative">
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 dark:text-primary/80">
                  {isDriver ? "Total Disetor" : "Total Berhasil"}
                </p>
                <p className="text-xl font-extrabold text-foreground mt-0.5 tracking-tight">
                  Rp {totalAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Trip</p>
                  <p className="text-sm font-bold text-foreground">{summaryCounts.totalTrips}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Lunas</p>
                  <p className="text-sm font-bold text-success">{summaryCounts.lunasCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Nunggak</p>
                  <p className="text-sm font-bold text-warning">{summaryCounts.nunggakCount}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={isDriver ? "Cari rute..." : "Cari transaksi..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card border-border pl-11 h-11 rounded-xl"
            />
          </div>
        </div>

        {/* Filter by Driver & Date */}
        <div className="flex gap-2">
          {isAdmin && (
            <Select value={filterDriver} onValueChange={(v) => setFilterDriver(v === "all" ? "" : v)}>
              <SelectTrigger className="bg-card border-border h-10 rounded-xl flex-1">
                <SelectValue placeholder="Semua Supir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Supir</SelectItem>
                {activeDrivers.map((d) => (
                  <SelectItem key={d.id} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="bg-card border-border h-10 rounded-xl flex-1"
            placeholder="Dari"
          />
          <Input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="bg-card border-border h-10 rounded-xl flex-1"
            placeholder="Sampai"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          {[
            { key: "all", label: "Semua" },
            { key: "success", label: isDriver ? "Disetor" : "Berhasil" },
            { key: "pending", label: isDriver ? "Belum Setor" : "Pending" },
            ...(isAdmin ? [{ key: "failed", label: "Gagal" }] : []),
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all",
                activeFilter === filter.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground border border-border shadow-sm hover:border-primary/50 dark:bg-secondary dark:border-foreground/15 dark:shadow-none"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        {loadingApi ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Memuat data...</p>
            </div>
          </div>
        ) : (
        <div className="space-y-4">
          {renderedList}
          {filteredTransactions.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Belum ada riwayat untuk periode ini
            </div>
          )}
          {hasMoreTransactions && (
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl"
              onClick={loadMoreTransactions}
              disabled={loadingMoreApi}
            >
              {loadingMoreApi ? "Memuat..." : "Muat 3 hari sebelumnya"}
            </Button>
          )}
        </div>
        )}
      </div>

      {/* Transaction Detail Sheet */}
      {selectedTx && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] animate-fade-in"
          onClick={() => setSelectedTx(null)}
        >
          <div 
            className="fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border rounded-t-3xl max-h-[85vh] overflow-y-auto will-change-transform"
            style={{ animation: "slideUpSheet 300ms cubic-bezier(0.32, 0.72, 0, 1) forwards" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 rounded-full bg-muted mx-auto mt-3 sticky top-0" />
            <div className="p-4 pt-2 pb-24">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Detail Transaksi</h2>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedTx(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="text-center py-4 border-b border-border mb-4">
                <Badge className={cn("mb-2", getStatusConfig(selectedTx.status, isDriver).color)}>
                  {getStatusConfig(selectedTx.status, isDriver).label}
                </Badge>
                <p className="text-3xl font-bold text-foreground">
                  Rp {selectedTx.amount.toLocaleString("id-ID")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{selectedTx.id}</p>
              </div>

              <div className="space-y-3">
                {isDriver ? (
                  <>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Rute</span>
                      <span className="font-medium text-foreground">{selectedTx.route}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Argo</span>
                      <span className="font-medium text-foreground">Rp {selectedTx.argo.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Tipe Order</span>
                      <span className="font-medium text-foreground capitalize">{selectedTx.type}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Driver</span>
                      <span className="font-medium text-foreground">{selectedTx.driver}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Kendaraan</span>
                      <span className="font-medium text-foreground">{selectedTx.vehicle}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Rute</span>
                      <span className="font-medium text-foreground">{selectedTx.route}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Argo</span>
                      <span className="font-medium text-foreground">Rp {selectedTx.argo.toLocaleString("id-ID")}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Tanggal</span>
                  <span className="font-medium text-foreground">{selectedTx.date}, {selectedTx.time}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">
                    {isDriver ? "Status" : "Metode"}
                  </span>
                  <span className="font-medium text-foreground">{selectedTx.method}</span>
                </div>
              </div>

              {selectedTx.status === "success" && isDriver && (
                <Button 
                  className="w-full mt-6 h-12 rounded-xl bg-primary text-primary-foreground"
                  onClick={() => {
                    setSelectedTx(null)
                    router.push("/deposit?tab=setoran")
                  }}
                >
                  Lihat Detail
                </Button>
              )}
              
              {isDriver && selectedTx.status === "pending" && (
                <Button className="w-full mt-6 h-12 rounded-xl bg-primary text-primary-foreground">
                  Setor Sekarang
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </PullToRefresh>
  )
}
