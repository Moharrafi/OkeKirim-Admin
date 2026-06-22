"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Banknote,
  Plus,
  Trash2,
  X,
  Calendar,
  CheckCircle2,
  Clock,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Receipt,
  Car
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import { PullToRefresh } from "@/components/pull-to-refresh"

interface Debt {
  id: number
  driver: string | null
  vehicle: string | null
  type: string | null
  amount: number
  date: string | null
  dueDate: string | null
  status: string
  paidAmount: number
  lastPaidAt: string | null
  paidOffAt: string | null
  notes: string | null
  created_at: string | null
}

interface DebtPayment {
  id: number
  debt_id: number
  driver: string | null
  amount: number
  paid_at: string | null
  notes: string | null
  created_at: string | null
}

export default function HutangPage() {
  const router = useRouter()
  const { isAdmin, user, isAuthenticated } = useUser()
  const [debts, setDebts] = useState<Debt[]>([])
  const [payments, setPayments] = useState<DebtPayment[]>([])
  const [drivers, setDrivers] = useState<Array<{ id: number; name: string; vehicle: string | null; status: string }>>([])
  const [loading, setLoading] = useState(true)

  // Filter States
  const [filterStatus, setFilterStatus] = useState<"belum_lunas" | "lunas">("belum_lunas")
  const [filterDriver, setFilterDriver] = useState("")
  const [expandedDebtId, setExpandedDebtId] = useState<number | null>(null)

  // Add Debt Modal States
  const [showAddModal, setShowAddModal] = useState(false)
  const [formDriver, setFormDriver] = useState("")
  const [formVehicle, setFormVehicle] = useState("")
  const [formAmount, setFormAmount] = useState("")
  const [formDate, setFormDate] = useState("")
  const [formDueDate, setFormDueDate] = useState("")
  const [formNotes, setFormNotes] = useState("")

  // Pay Debt Modal States
  const [showPayModal, setShowPayModal] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState("")
  const [payNotes, setPayNotes] = useState("")

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  const refreshData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const driverParam = isAdmin ? "" : `?driver=${encodeURIComponent(user.name || "")}`
      const [debtsRes, driversRes] = await Promise.all([
        fetch(`/api/debts${driverParam}`),
        fetch("/api/drivers")
      ])
      const [debtsData, driversData] = await Promise.all([
        debtsRes.json(),
        driversRes.json()
      ])
      setDebts(debtsData.debts || [])
      setPayments(debtsData.payments || [])
      setDrivers(driversData.drivers || [])

      sessionStorage.setItem(
        "hutang_page_cache",
        JSON.stringify({
          debts: debtsData.debts || [],
          payments: debtsData.payments || [],
          drivers: driversData.drivers || [],
          timestamp: Date.now()
        })
      )
    } catch (err) {
      console.error("Failed to load debts page data:", err)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, user.name])

  useEffect(() => {
    const cached = sessionStorage.getItem("hutang_page_cache")
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Date.now() - parsed.timestamp < 3 * 60 * 1000) {
          setDebts(parsed.debts || [])
          setPayments(parsed.payments || [])
          setDrivers(parsed.drivers || [])
          setLoading(false)
          refreshData(false)
          return
        }
      } catch {}
    }
    refreshData()
  }, [refreshData])

  const formatRupiah = (amount: number): string => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  }

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    })
  }

  const handleSaveDebt = async () => {
    if (!formDriver || !formAmount) return

    const driverObj = drivers.find(d => d.name === formDriver)
    const vehicle = driverObj?.vehicle || formVehicle

    try {
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver: formDriver,
          vehicle: vehicle || null,
          amount: parseInt(formAmount),
          date: formDate || undefined,
          dueDate: formDueDate || null,
          notes: formNotes || null
        })
      })

      if (res.ok) {
        resetAddForm()
        await refreshData(false)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSavePayment = async () => {
    if (!selectedDebt || !payAmount) return

    try {
      const res = await fetch("/api/debts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debt_id: selectedDebt.id,
          amount: parseInt(payAmount),
          notes: payNotes || null,
          paid_at: payDate || undefined
        })
      })

      if (res.ok) {
        resetPayForm()
        await refreshData(false)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteDebt = async (id: number) => {
    if (!confirm("Hapus data kasbon ini dan seluruh riwayat pembayarannya?")) return
    try {
      const res = await fetch("/api/debts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: "debt" })
      })
      if (res.ok) {
        setDebts(prev => prev.filter(d => d.id !== id))
        setPayments(prev => prev.filter(p => p.debt_id !== id))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm("Hapus catatan pembayaran ini?")) return
    try {
      const res = await fetch("/api/debts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: paymentId, type: "payment" })
      })
      if (res.ok) {
        await refreshData(false)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const resetAddForm = () => {
    setShowAddModal(false)
    setFormDriver("")
    setFormVehicle("")
    setFormAmount("")
    setFormDate("")
    setFormDueDate("")
    setFormNotes("")
  }

  const resetPayForm = () => {
    setShowPayModal(false)
    setSelectedDebt(null)
    setPayAmount("")
    setPayDate("")
    setPayNotes("")
  }

  // Filtered lists
  const filteredDebts = debts.filter(d => {
    const statusMatch = d.status === filterStatus
    const driverMatch = !filterDriver || d.driver === filterDriver
    return statusMatch && driverMatch
  })

  // Calculate totals
  const totalUnpaidAmount = filteredDebts.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)

  if (!isAuthenticated) return null

  return (
    <PullToRefresh onRefresh={refreshData}>
      <div className="min-h-screen pb-24">
        <MobileHeader title="Hutang Kasbon" showBack onBack={() => router.push("/")} />

        <div className="px-4 py-4 space-y-4">
          {/* Header Stats */}
          {filteredDebts.length > 0 && (
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Kasbon Belum Lunas</p>
                  <p className="text-xl font-bold text-destructive mt-1">
                    Rp {formatRupiah(totalUnpaidAmount)}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-destructive/10">
                  <Banknote className="h-6 w-6 text-destructive" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filter Status & Add Button */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(["belum_lunas", "lunas"] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    "text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all border",
                    filterStatus === status
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-secondary text-muted-foreground border-transparent hover:border-border"
                  )}
                >
                  {status === "belum_lunas" ? "Belum Lunas" : "Lunas"}
                </button>
              ))}
            </div>
            {isAdmin && (
              <Button
                size="sm"
                className="rounded-xl bg-primary text-primary-foreground"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Tambah
              </Button>
            )}
          </div>

          {/* Admin filter by Driver */}
          {isAdmin && (
            <select
              value={filterDriver}
              onChange={(e) => setFilterDriver(e.target.value)}
              className="w-full h-11 rounded-xl bg-card border border-border px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <option value="">Semua Supir</option>
              {drivers.filter(d => d.status === "aktif").map(d => (
                <option key={d.id} value={d.name}>{d.name} ({d.vehicle || "-"})</option>
              ))}
            </select>
          )}

          {/* Debt cards list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 rounded-2xl bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : filteredDebts.length === 0 ? (
            <div className="text-center py-16">
              <Banknote className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-60" />
              <p className="text-muted-foreground text-sm">Tidak ada data kasbon</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDebts.map((debt) => {
                const sisa = debt.amount - debt.paidAmount
                const debtPayments = payments.filter(p => p.debt_id === debt.id)
                const isExpanded = expandedDebtId === debt.id

                return (
                  <Card key={debt.id} className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-xl",
                            debt.status === "lunas" ? "bg-success/10" : "bg-destructive/10"
                          )}>
                            <Banknote className={cn(
                              "h-5 w-5",
                              debt.status === "lunas" ? "text-success" : "text-destructive"
                            )} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{debt.driver}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Car className="h-3 w-3" />
                              {debt.vehicle || "-"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteDebt(debt.id)}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-red-400 hover:text-destructive transition-colors"
                              aria-label="Hapus kasbon"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            debt.status === "lunas"
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-destructive/10 text-destructive border-destructive/20"
                          )}>
                            {debt.status === "lunas" ? "Lunas" : "Belum Lunas"}
                          </span>
                        </div>
                      </div>

                      {/* Transaction Amounts */}
                      <div className="grid grid-cols-3 gap-2.5 pt-1.5 border-t border-border/60">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Total Pinjaman</p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">
                            Rp {formatRupiah(debt.amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Terbayar</p>
                          <p className="text-sm font-semibold text-success mt-0.5">
                            Rp {formatRupiah(debt.paidAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Sisa Hutang</p>
                          <p className="text-sm font-bold text-destructive mt-0.5">
                            Rp {formatRupiah(sisa)}
                          </p>
                        </div>
                      </div>

                      {/* Dates & Notes */}
                      <div className="space-y-1.5 text-xs text-muted-foreground pt-1.5">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Pinjam: {formatDate(debt.date)}
                          </span>
                          {debt.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-destructive" />
                              Jatuh Tempo: {formatDate(debt.dueDate)}
                            </span>
                          )}
                        </div>
                        {debt.notes && (
                          <p className="bg-secondary/40 p-2 rounded-lg text-foreground italic">
                            &ldquo;{debt.notes}&rdquo;
                          </p>
                        )}
                      </div>

                      {/* Payment History and Actions */}
                      <div className="pt-2 flex items-center justify-between border-t border-border/40">
                        <button
                          onClick={() => setExpandedDebtId(isExpanded ? null : debt.id)}
                          className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                        >
                          {debtPayments.length} Pembayaran
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>

                        {isAdmin && debt.status !== "lunas" && (
                          <Button
                            size="sm"
                            className="h-8 rounded-xl bg-success text-success-foreground hover:bg-success/95 text-xs"
                            onClick={() => { setSelectedDebt(debt); setShowPayModal(true) }}
                          >
                            Bayar Cicilan
                          </Button>
                        )}
                      </div>

                      {/* Expanded History list */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2 border-t border-border/40 pt-3 animate-in slide-in-from-top-2 duration-200">
                          <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                            <Receipt className="h-3.5 w-3.5 text-primary" />
                            Riwayat Cicilan
                          </p>
                          {debtPayments.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-1">Belum ada cicilan tercatat.</p>
                          ) : (
                            <div className="space-y-1.5 pl-1.5 border-l-2 border-primary/20">
                              {debtPayments.map((p) => (
                                <div key={p.id} className="flex items-start justify-between gap-3 text-xs p-1.5 rounded-lg bg-secondary/35">
                                  <div>
                                    <p className="font-semibold text-foreground">Rp {formatRupiah(p.amount)}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Tanggal: {formatDate(p.paid_at)}</p>
                                    {p.notes && <p className="text-[10px] text-muted-foreground/80 mt-0.5 italic">&ldquo;{p.notes}&rdquo;</p>}
                                  </div>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDeletePayment(p.id)}
                                      className="text-red-400 hover:text-destructive p-1 rounded-md"
                                      aria-label="Hapus cicilan"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal: Tambah Kasbon (Admin Only) */}
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={resetAddForm} />
            <div className="relative bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">Tambah Kasbon Driver</h3>
                <button onClick={resetAddForm} className="p-1 rounded-full hover:bg-secondary">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Pilih Driver</Label>
                  <select
                    value={formDriver}
                    onChange={(e) => {
                      setFormDriver(e.target.value)
                      const driverObj = drivers.find(d => d.name === e.target.value)
                      setFormVehicle(driverObj?.vehicle || "")
                    }}
                    className="w-full h-11 rounded-xl mt-1 bg-secondary border-0 px-3 text-sm text-foreground focus-visible:outline-none"
                  >
                    <option value="">Pilih driver...</option>
                    {drivers.filter(d => d.status === "aktif").map(d => (
                      <option key={d.id} value={d.name}>{d.name} ({d.vehicle || "-"})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Kendaraan / Plat Nomor</Label>
                  <Input
                    value={formVehicle}
                    onChange={(e) => setFormVehicle(e.target.value)}
                    placeholder="Contoh: B 1234 ABC"
                    className="bg-secondary border-0 h-11 rounded-xl mt-1 focus-visible:ring-primary/40"
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Nominal Pinjaman</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                    <Input
                      type="number"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="0"
                      className="bg-secondary border-0 h-11 rounded-xl pl-9 focus-visible:ring-primary/40"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Tanggal Pinjam</Label>
                  <Input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="bg-secondary border-0 h-11 rounded-xl mt-1 focus-visible:ring-primary/40"
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Jatuh Tempo (Opsional)</Label>
                  <Input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="bg-secondary border-0 h-11 rounded-xl mt-1 focus-visible:ring-primary/40"
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Catatan / Keterangan</Label>
                  <Textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Keperluan kasbon..."
                    className="bg-secondary border-0 rounded-xl mt-1 min-h-16 focus-visible:ring-primary/40"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={resetAddForm}>Batal</Button>
                <Button
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground"
                  onClick={handleSaveDebt}
                  disabled={!formDriver || !formAmount}
                >
                  Simpan
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Bayar Cicilan (Admin Only) */}
        {showPayModal && selectedDebt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={resetPayForm} />
            <div className="relative bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">Catat Pembayaran Cicilan</h3>
                <button onClick={resetPayForm} className="p-1 rounded-full hover:bg-secondary">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-secondary/40 p-3.5 rounded-xl border border-border/40 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Driver:</span>
                    <span className="font-semibold text-foreground">{selectedDebt.driver}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Sisa Pinjaman:</span>
                    <span className="font-bold text-destructive">Rp {formatRupiah(selectedDebt.amount - selectedDebt.paidAmount)}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Nominal Pembayaran</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                    <Input
                      type="number"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0"
                      className="bg-secondary border-0 h-11 rounded-xl pl-9 focus-visible:ring-primary/40"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Tanggal Pembayaran</Label>
                  <Input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="bg-secondary border-0 h-11 rounded-xl mt-1 focus-visible:ring-primary/40"
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Catatan / Referensi</Label>
                  <Textarea
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="Contoh: cash, potong gaji, transfer bank..."
                    className="bg-secondary border-0 rounded-xl mt-1 min-h-16 focus-visible:ring-primary/40"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={resetPayForm}>Batal</Button>
                <Button
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground"
                  onClick={handleSavePayment}
                  disabled={!payAmount}
                >
                  Simpan Bayar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  )
}
