"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Download,
  Smartphone,
  Banknote,
  ChevronRight,
  X,
  Calendar,
  Filter,
  MapPin,
  Wallet,
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
import { fetchSchedules, fetchHistory, fetchDrivers, type Schedule, type Driver } from "@/lib/okekirim-api"

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

  if (!isAuthenticated) {
    return null
  }
  const [selectedTx, setSelectedTx] = useState<{
    id: string; date: string; time: string; driver: string; vehicle: string;
    route: string; amount: number; type: string; method: string; status: string;
  } | null>(null)
  const [apiTransactions, setApiTransactions] = useState<Array<{
    id: string; date: string; time: string; driver: string; vehicle: string;
    route: string; amount: number; type: string; method: string; status: string;
  }>>([])
  const [loadingApi, setLoadingApi] = useState(false)
  const [apiDrivers, setApiDrivers] = useState<Driver[]>([])
  const [filterDriver, setFilterDriver] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [totalTrips, setTotalTrips] = useState(0)
  const [lunasCount, setLunasCount] = useState(0)
  const [nunggakCount, setNunggakCount] = useState(0)

  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 20

  useEffect(() => {
    fetchDrivers().then(setApiDrivers).catch(() => {})
  }, [])

  useEffect(() => {
    setLoadingApi(true)
    setCurrentPage(1)
    setApiTransactions([])
    setHasMore(true)
    const driverName = isDriver ? user.name : (filterDriver || undefined)
    // Fetch ALL schedules for summary counts only
    fetchSchedules(undefined, driverName)
      .then((allSchedules) => {
        const lunas = allSchedules.filter(s => s.status === "lunas")
        const nunggak = allSchedules.filter(s => s.status === "nunggak")
        setTotalTrips(allSchedules.length)
        setLunasCount(lunas.length)
        setNunggakCount(nunggak.length)

        // Display first page of lunas
        const mapped = lunas.map(s => ({
          id: `TRX-${String(s.id).padStart(3, "0")}`,
          date: s.date ? new Date(s.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-",
          time: s.lastPaidAt ? new Date(s.lastPaidAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "",
          driver: s.driver || "Unknown",
          vehicle: s.vehicle || s.driverVehicle || "-",
          route: `${s.origin || "-"} - ${s.destination || "-"}`,
          amount: s.fare || 0,
          type: s.orderType === "offline" ? "offline" : "online",
          method: s.payment_notes || s.paymentNotes || "Transfer",
          status: "success" as const,
        }))
        setApiTransactions(mapped.slice(0, PAGE_SIZE))
        setHasMore(mapped.length > PAGE_SIZE)
        // Store full list for load more
        ;(window as unknown as Record<string, unknown>).__allTransactions = mapped
      })
      .catch(() => setApiTransactions([]))
      .finally(() => setLoadingApi(false))
  }, [filterDriver, filterDateFrom, filterDateTo, isDriver, user.name])

  const handleLoadMore = () => {
    setLoadingMore(true)
    const allTx = (window as unknown as Record<string, unknown>).__allTransactions as typeof apiTransactions || []
    const nextPage = currentPage + 1
    const nextItems = allTx.slice(0, nextPage * PAGE_SIZE)
    setApiTransactions(nextItems)
    setCurrentPage(nextPage)
    setHasMore(nextItems.length < allTx.length)
    setLoadingMore(false)
  }

  const transactions = apiTransactions

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch = isDriver
      ? tx.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.id.toLowerCase().includes(searchQuery.toLowerCase())
      : tx.driver.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = activeFilter === "all" || tx.status === activeFilter
    return matchesSearch && matchesFilter
  })

  const totalAmount = transactions
    .filter((tx) => tx.status === "success")
    .reduce((sum, tx) => sum + tx.amount, 0)

  const groupedTransactions = filteredTransactions.reduce((groups, tx) => {
    const date = tx.date
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(tx)
    return groups
  }, {} as Record<string, typeof transactions>)

  return (
    <div className="min-h-screen pb-24">
      <MobileHeader title="Riwayat" />
      
      <div className="px-4 py-4 space-y-4">
        {/* Summary */}
        <Card className="bg-primary/[0.15] dark:bg-primary/15 border-primary/25 dark:border-primary/20 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/70 dark:text-primary/80">
                  {isDriver ? "Total Disetor" : "Total Berhasil"}
                </p>
                <p className="text-[1.75rem] font-extrabold text-foreground mt-1 tracking-tight">
                  Rp {totalAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-primary/10 dark:bg-primary/20">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t border-primary/10">
              <div>
                <p className="text-[11px] text-muted-foreground">Total Trip</p>
                <p className="text-lg font-bold text-foreground">{totalTrips}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Lunas</p>
                <p className="text-lg font-bold text-success">{lunasCount}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Belum Setor</p>
                <p className="text-lg font-bold text-warning">{nunggakCount}</p>
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
                {apiDrivers.map((d) => (
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
                  : "bg-secondary text-muted-foreground"
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
                              {isDriver ? tx.route : tx.driver}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isDriver ? `${tx.type === "online" ? "Online" : "Offline"} • ${tx.time}` : `${tx.method} • ${tx.time}`}
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

          {/* Load More Button */}
          {hasMore && !loadingApi && (
            <div className="flex justify-center pt-4 pb-2">
              <Button
                variant="outline"
                className="rounded-xl px-6"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Memuat..." : `Muat Lagi (${apiTransactions.length} dari ${lunasCount})`}
              </Button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Transaction Detail Sheet */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedTx(null)}>
          <div 
            className="fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border rounded-t-3xl max-h-[85vh] overflow-y-auto"
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
  )
}
