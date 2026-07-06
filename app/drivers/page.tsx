"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Car,
  Printer,
  Loader2,
  Key,
  Search,
  ChevronDown,
  TrendingUp,
  Wallet,
  ShieldAlert,
  CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import { type Driver } from "@/lib/okekirim-api"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { ConfirmDialog } from "@/components/confirm-dialog"


export default function DriversPage() {
  const router = useRouter()
  const { isAdmin, isAuthenticated } = useUser()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
  const [formName, setFormName] = useState("")
  const [formVehicle, setFormVehicle] = useState("")
  const [formVehicleType, setFormVehicleType] = useState("")
  const [formStatus, setFormStatus] = useState("aktif")
  const [formPhone, setFormPhone] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formAddress, setFormAddress] = useState("")
  const [formVehicleYear, setFormVehicleYear] = useState("")

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: () => {},
  })

  // Detail Modal States
  const [showDetail, setShowDetail] = useState(false)
  const [detailDriver, setDetailDriver] = useState<Driver | null>(null)
  const [detailData, setDetailData] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"semua" | "aktif" | "nonaktif">("semua")

  // Vehicle Input Mode State
  const [isManualVehicle, setIsManualVehicle] = useState(false)
  const [allVehicles, setAllVehicles] = useState<string[]>([])

  // Calculate idle plates (plates from all historical vehicles that are not used by active drivers)
  const idlePlates = useMemo(() => {
    const activePlates = new Set(
      drivers
        .filter((d) => d.status === "aktif" && d.vehicle)
        .map((d) => d.vehicle!.trim().toUpperCase())
    )

    const plateRegex = /^[A-Z]{1,2}\s*\d{1,4}\s*[A-Z]{1,3}$/i

    // Use allVehicles list from DB instead of just inactive drivers
    const plates = allVehicles.filter(
      (plate) => !activePlates.has(plate) && plateRegex.test(plate)
    )

    // If editing a driver, also include their current vehicle value in the dropdown options
    if (editingDriver && editingDriver.vehicle) {
      const currentPlate = editingDriver.vehicle.trim().toUpperCase()
      if (!plates.includes(currentPlate)) {
        plates.unshift(currentPlate)
      }
    }

    return plates
  }, [drivers, allVehicles, editingDriver])

  // Filtered drivers based on search query and status filter
  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      const matchesSearch =
        driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (driver.vehicle && driver.vehicle.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesStatus =
        statusFilter === "semua" ||
        (statusFilter === "aktif" && driver.status === "aktif") ||
        (statusFilter === "nonaktif" && driver.status !== "aktif")
        
      return matchesSearch && matchesStatus
    })
  }, [drivers, searchQuery, statusFilter])

  const handleShowDetail = async (driver: Driver) => {
    setDetailDriver(driver)
    setShowDetail(true)
    setDetailLoading(true)
    setDetailData(null)
    try {
      const resp = await fetch(`/api/report/driver?name=${encodeURIComponent(driver.name)}`)
      if (resp.ok) {
        const result = await resp.json()
        setDetailData(result)
      }
    } catch (err) {
      console.error("Gagal mengambil rincian driver:", err)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
    if (!isAdmin) router.push("/")
  }, [isAuthenticated, isAdmin, router])

  const refreshDrivers = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch("/api/drivers")
      if (resp.ok) {
        const data = await resp.json()
        setDrivers(data.drivers || [])
        setAllVehicles(data.vehicles || [])
      }
    } catch (err) {
      console.warn("Gagal memuat data driver:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshDrivers()
  }, [refreshDrivers])

  const handleSave = async () => {
    const body = {
      name: formName,
      vehicle: formVehicle,
      vehicleType: formVehicleType,
      status: formStatus,
      phone: formPhone,
      email: formEmail,
      address: formAddress,
      vehicleYear: formVehicleYear
    }
    
    if (editingDriver) {
      await fetch(`/api/drivers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, id: editingDriver.id }),
      })
    } else {
      await fetch(`/api/drivers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    }
    
    // Refresh
    await refreshDrivers()
    resetForm()
  }

  const handleDelete = async (id: number) => {
    setConfirmDialog({
      open: true,
      title: "Hapus Driver?",
      message: "Hapus driver ini?",
      onConfirm: async () => {
        await fetch(`/api/drivers`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        })
        setDrivers(prev => prev.filter(d => d.id !== id))
        refreshDrivers().catch(() => {})
      }
    })
  }

  const handleResetPassword = async (driverId: number, driverName: string) => {
    setConfirmDialog({
      open: true,
      title: "Reset Password?",
      message: `Reset password untuk driver ${driverName}? Driver harus mendaftar ulang untuk membuat password baru.`,
      onConfirm: async () => {
        try {
          const resp = await fetch("/api/drivers/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: driverId }),
          })
          if (resp.ok) {
            alert(`Password untuk ${driverName} berhasil di-reset. Driver sekarang bisa mendaftar ulang.`)
            refreshDrivers().catch(() => {})
            setShowDetail(false)
          } else {
            const errorData = await resp.json()
            alert(`Gagal reset password: ${errorData.error || resp.statusText}`)
          }
        } catch (e) {
          console.error(e)
          alert("Gagal menghubungi server untuk reset password")
        }
      }
    })
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingDriver(null)
    setFormName("")
    setFormVehicle("")
    setFormVehicleType("")
    setFormStatus("aktif")
    setFormPhone("")
    setFormEmail("")
    setFormAddress("")
    setFormVehicleYear("")
    setIsManualVehicle(false) // Reset manual vehicle input flag
  }

  const startEdit = (driver: Driver) => {
    setEditingDriver(driver)
    setFormName(driver.name)
    setFormVehicle(driver.vehicle || "")
    setFormVehicleType(driver.vehicleType || "")
    setFormStatus(driver.status || "aktif")
    setFormPhone(driver.phone || "")
    setFormEmail(driver.email || "")
    setFormAddress(driver.address || "")
    setFormVehicleYear(driver.vehicleYear || "")
    setIsManualVehicle(false) // Start with dropdown when editing too
    setShowForm(true)
  }

  if (!isAuthenticated || !isAdmin) return null

  return (
    <PullToRefresh onRefresh={refreshDrivers}>
      <div className="min-h-screen pb-24 bg-background">
        <MobileHeader title="Kelola Driver" showBack onBack={() => router.push("/")} />

        <div className="px-4 py-4 space-y-5">

          {/* Header + Add Button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">{drivers.length} driver terdaftar</p>
            <Button
              size="sm"
              className="rounded-xl bg-primary text-primary-foreground font-semibold"
              onClick={() => { resetForm(); setShowForm(true) }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Tambah
            </Button>
          </div>

          {/* Search & Filter */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari nama atau plat nomor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9 h-11 bg-card border border-border rounded-xl text-sm focus-visible:ring-1 focus-visible:ring-primary shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-secondary text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Status Tabs */}
            <div className="flex gap-2">
              {[
                { key: "semua", label: "Semua Driver" },
                { key: "aktif", label: "Aktif" },
                { key: "nonaktif", label: "Nonaktif" }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key as any)}
                  className={cn(
                    "text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all border",
                    statusFilter === tab.key
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-secondary text-muted-foreground border-transparent hover:border-border"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Driver List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse border border-border/20" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDrivers.map((driver) => {
                return (
                  <Card
                    key={driver.id}
                    className="border border-border bg-card cursor-pointer hover:bg-card/90 active:scale-[0.99] transition-all duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.015)] rounded-2xl"
                    onClick={() => handleShowDetail(driver)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-primary/10">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground leading-tight">{driver.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {driver.vehicle && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Car className="h-3.5 w-3.5 text-muted-foreground" />
                                  {driver.vehicle}
                                </span>
                              )}
                              {driver.vehicleType && (
                                <span className="text-[10px] font-semibold text-muted-foreground/80 px-1.5 py-0.2 bg-secondary border border-border/40 rounded">
                                  {driver.vehicleType}
                                </span>
                              )}
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                driver.status === "aktif"
                                  ? "bg-success/10 text-success border-success/20"
                                  : "bg-muted text-muted-foreground border-border/40"
                              )}>
                                {driver.status === "aktif" ? "Aktif" : "Nonaktif"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => startEdit(driver)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(driver.id)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-red-400 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {/* Empty State */}
              {filteredDrivers.length === 0 && (
                <div className="text-center py-16">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-60" />
                  <p className="text-muted-foreground text-sm font-medium">Driver tidak ditemukan</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity" onClick={resetForm} />
            <div className="relative bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">
                  {editingDriver ? "Edit Driver" : "Tambah Driver"}
                </h3>
                <button onClick={resetForm} className="p-1 rounded-full hover:bg-secondary">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nama Driver</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Masukkan nama..."
                    className="bg-card border border-border h-11 rounded-xl mt-1.5 focus-visible:ring-1 focus-visible:ring-primary/40 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">No. HP</Label>
                  <Input
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Masukkan no hp..."
                    className="bg-card border border-border h-11 rounded-xl mt-1.5 focus-visible:ring-1 focus-visible:ring-primary/40 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</Label>
                  <Input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="Masukkan email..."
                    className="bg-card border border-border h-11 rounded-xl mt-1.5 focus-visible:ring-1 focus-visible:ring-primary/40 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alamat</Label>
                  <Input
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Masukkan alamat..."
                    className="bg-card border border-border h-11 rounded-xl mt-1.5 focus-visible:ring-1 focus-visible:ring-primary/40 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plat Kendaraan</Label>
                  {!isManualVehicle && idlePlates.length > 0 ? (
                    <div className="relative mt-1.5">
                      <select
                        value={formVehicle}
                        onChange={(e) => {
                          if (e.target.value === "__MANUAL__") {
                            setIsManualVehicle(true)
                            setFormVehicle("")
                          } else {
                            setFormVehicle(e.target.value)
                          }
                        }}
                        className="w-full h-11 rounded-xl bg-card border border-border px-3 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                      >
                        <option value="">Pilih nopol...</option>
                        {idlePlates.map((plate) => (
                          <option key={plate} value={plate}>
                            {plate}
                          </option>
                        ))}
                        <option value="__MANUAL__" className="text-primary font-bold">
                          + Input Plat Baru Manual
                        </option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                  ) : (
                    <div className="relative mt-1.5 flex gap-2">
                      <Input
                        value={formVehicle}
                        onChange={(e) => setFormVehicle(e.target.value)}
                        placeholder="Contoh: B 1234 ABC"
                        className="bg-card border border-border h-11 rounded-xl flex-1 font-mono uppercase font-bold text-sm"
                      />
                      {idlePlates.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsManualVehicle(false)
                            setFormVehicle(editingDriver?.vehicle || "")
                          }}
                          className="h-11 px-3.5 rounded-xl border-border text-xs font-bold hover:bg-secondary transition-colors"
                        >
                          List
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jenis Kendaraan</Label>
                  <div className="relative mt-1.5">
                    <select
                      value={formVehicleType}
                      onChange={(e) => setFormVehicleType(e.target.value)}
                      className="w-full h-11 rounded-xl bg-card border border-border px-3 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      <option value="">Pilih jenis...</option>
                      <option value="CDE">CDE (Engkel)</option>
                      <option value="CDD">CDD (Double)</option>
                      <option value="Fuso">Fuso</option>
                      <option value="Tronton">Tronton</option>
                      <option value="Pickup">Pickup</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tahun Kendaraan</Label>
                  <Input
                    value={formVehicleYear}
                    onChange={(e) => setFormVehicleYear(e.target.value)}
                    placeholder="Contoh: 2022"
                    className="bg-card border border-border h-11 rounded-xl mt-1.5 focus-visible:ring-1 focus-visible:ring-primary/40 text-sm"
                  />
                </div>

                {editingDriver && (
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</Label>
                    <div className="flex gap-2.5 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setFormStatus("aktif")}
                        className={cn(
                          "flex-1 h-11 rounded-xl text-xs font-bold transition-all border",
                          formStatus === "aktif"
                            ? "bg-success/10 text-success border-success/20 shadow-xs"
                            : "bg-secondary text-muted-foreground border-transparent hover:border-border"
                        )}
                      >
                        Aktif
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormStatus("nonaktif")}
                        className={cn(
                          "flex-1 h-11 rounded-xl text-xs font-bold transition-all border",
                          formStatus === "nonaktif"
                            ? "bg-destructive/10 text-destructive border-destructive/20 shadow-xs"
                            : "bg-secondary text-muted-foreground border-transparent hover:border-border"
                        )}
                      >
                        Tidak Aktif
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-semibold" onClick={resetForm}>
                  Batal
                </Button>
                <Button
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm"
                  onClick={handleSave}
                  disabled={!formName.trim()}
                >
                  {editingDriver ? "Simpan" : "Tambah"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetail && detailDriver && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity" onClick={() => setShowDetail(false)} />
            <div className="relative bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">Detail Keuangan</h3>
                <button onClick={() => setShowDetail(false)} className="p-1 rounded-full hover:bg-secondary">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Driver info card */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{detailDriver.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {detailDriver.vehicle || "-"} {detailDriver.vehicleType ? `(${detailDriver.vehicleType})` : ""}
                    </p>
                  </div>
                </div>

                {/* Driver Profile Info */}
                <div className="p-3 rounded-xl bg-secondary/35 border border-border/50 text-[11px] space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">No. HP:</span>
                    <span className="font-semibold text-foreground">{detailDriver.phone || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Email:</span>
                    <span className="font-semibold text-foreground truncate max-w-[180px]">{detailDriver.email || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Alamat:</span>
                    <span className="font-semibold text-foreground truncate max-w-[180px]">{detailDriver.address || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Tahun Kendaraan:</span>
                    <span className="font-semibold text-foreground">{detailDriver.vehicleYear || "-"}</span>
                  </div>
                </div>

                {detailLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                    <p className="text-xs text-muted-foreground">Memuat data keuangan...</p>
                  </div>
                ) : detailData ? (
                  <div className="space-y-4">
                    {/* Setoran Section */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Setoran Trip</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-3 rounded-xl bg-secondary/40 border border-border/30">
                          <p className="text-[10px] text-muted-foreground font-medium">Wajib Setor</p>
                          <p className="font-semibold text-foreground mt-0.5">
                            Rp {detailData.deposits.summary.totalCompanyShare.toLocaleString("id-ID")}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-secondary/40 border border-border/30 border-l-2 border-l-amber-500">
                          <p className="text-[10px] text-muted-foreground font-medium">Sisa Setoran</p>
                          <p className="font-bold text-amber-500 mt-0.5">
                            Rp {detailData.deposits.summary.totalRemaining.toLocaleString("id-ID")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Kasbon Section */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kasbon / Hutang</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-3 rounded-xl bg-secondary/40 border border-border/30">
                          <p className="text-[10px] text-muted-foreground font-medium">Total Kasbon</p>
                          <p className="font-semibold text-foreground mt-0.5">
                            Rp {detailData.debts.summary.totalDebt.toLocaleString("id-ID")}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-secondary/40 border border-border/30 border-l-2 border-l-red-500">
                          <p className="text-[10px] text-muted-foreground font-medium">Sisa Kasbon</p>
                          <p className="font-bold text-red-500 mt-0.5">
                            Rp {detailData.debts.summary.totalRemaining.toLocaleString("id-ID")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Total Tagihan */}
                    {(() => {
                      const totalLiabilities = detailData.deposits.summary.totalRemaining + detailData.debts.summary.totalRemaining;
                      return (
                        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-destructive uppercase tracking-wide text-[10px]">
                              Total Kewajiban
                            </span>
                            <span className="font-extrabold text-sm text-destructive">
                              Rp {totalLiabilities.toLocaleString("id-ID")}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-destructive">Gagal memuat data keuangan driver.</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 mt-6">
                <Button
                  variant="outline"
                  className="flex-1 h-10 rounded-xl text-xs font-semibold border-border hover:bg-secondary"
                  onClick={() => {
                    setShowDetail(false)
                    startEdit(detailDriver)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit Driver
                </Button>
                <Button
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
                  disabled={detailLoading || !detailData}
                  onClick={() => {
                    window.open(`/drivers/print?driver=${encodeURIComponent(detailDriver.name)}`, "_blank")
                  }}
                >
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  Cetak
                </Button>
              </div>
              <div className="mt-2">
                <Button
                  variant="outline"
                  className="w-full h-10 rounded-xl text-xs font-semibold border-destructive/20 text-destructive hover:bg-destructive/10 bg-destructive/5"
                  onClick={() => handleResetPassword(detailDriver.id, detailDriver.name)}
                >
                  <Key className="h-3.5 w-3.5 mr-1" />
                  Reset Password
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* Confirm Dialog */}
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.title.toLowerCase().includes("hapus") ? "Ya, Hapus" : (confirmDialog.title.toLowerCase().includes("reset") ? "Ya, Reset" : "Ya, Lanjutkan")}
          cancelText="Batal"
          onConfirm={() => {
            confirmDialog.onConfirm()
            setConfirmDialog(prev => ({ ...prev, open: false }))
          }}
          onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        />
      </div>
    </PullToRefresh>
  )
}
