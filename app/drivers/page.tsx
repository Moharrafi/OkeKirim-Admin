"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Users, Plus, Pencil, Trash2, X, Car, Printer, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import { fetchDrivers, type Driver } from "@/lib/okekirim-api"
import { PullToRefresh } from "@/components/pull-to-refresh"

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

  // Detail Modal States
  const [showDetail, setShowDetail] = useState(false)
  const [detailDriver, setDetailDriver] = useState<Driver | null>(null)
  const [detailData, setDetailData] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

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
    const body = { name: formName, vehicle: formVehicle, vehicleType: formVehicleType, status: formStatus }
    
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
    if (!confirm("Hapus driver ini?")) return
    await fetch(`/api/drivers`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setDrivers(prev => prev.filter(d => d.id !== id))
    refreshDrivers().catch(() => {})
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingDriver(null)
    setFormName("")
    setFormVehicle("")
    setFormVehicleType("")
    setFormStatus("aktif")
    setIsManualVehicle(false) // Reset manual vehicle input flag
  }

  const startEdit = (driver: Driver) => {
    setEditingDriver(driver)
    setFormName(driver.name)
    setFormVehicle(driver.vehicle || "")
    setFormVehicleType(driver.vehicleType || "")
    setFormStatus(driver.status || "aktif")
    setIsManualVehicle(false) // Start with dropdown when editing too
    setShowForm(true)
  }

  if (!isAuthenticated || !isAdmin) return null

  return (
    <PullToRefresh onRefresh={refreshDrivers}>
    <div className="min-h-screen pb-24">
      <MobileHeader title="Kelola Driver" showBack onBack={() => router.push("/")} />

      <div className="px-4 py-4 space-y-4">
        {/* Header + Add Button */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{drivers.length} driver terdaftar</p>
          <Button
            size="sm"
            className="rounded-xl bg-primary text-primary-foreground"
            onClick={() => { resetForm(); setShowForm(true) }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Tambah
          </Button>
        </div>

        {/* Driver List */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted/50 animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {drivers.map((driver) => (
              <Card
                key={driver.id}
                className="border-border bg-card cursor-pointer hover:bg-card/90 transition-colors"
                onClick={() => handleShowDetail(driver)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{driver.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {driver.vehicle && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Car className="h-3 w-3" />
                              {driver.vehicle}
                            </span>
                          )}
                          <span className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                            driver.status === "aktif" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                          )}>
                            {driver.status === "aktif" ? "Aktif" : "Nonaktif"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(driver);
                        }}
                        className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(driver.id);
                        }}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-red-400 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={resetForm} />
          <div className="relative bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">
                {editingDriver ? "Edit Driver" : "Tambah Driver"}
              </h3>
              <button onClick={resetForm} className="p-1 rounded-full hover:bg-secondary">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Nama Driver</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Masukkan nama..."
                  className="bg-secondary border-0 h-10 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Plat Kendaraan</Label>
                {!isManualVehicle && idlePlates.length > 0 ? (
                  <div className="mt-1">
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
                      className="w-full h-10 rounded-xl bg-secondary border-0 px-3 text-sm text-foreground appearance-none"
                    >
                      <option value="">Pilih nopol...</option>
                      {idlePlates.map((plate) => (
                        <option key={plate} value={plate}>
                          {plate}
                        </option>
                      ))}
                      <option value="__MANUAL__" className="text-primary font-semibold">
                        + Input Plat Baru Manual
                      </option>
                    </select>
                  </div>
                ) : (
                  <div className="relative mt-1 flex gap-2">
                    <Input
                      value={formVehicle}
                      onChange={(e) => setFormVehicle(e.target.value)}
                      placeholder="Contoh: B 1234 ABC"
                      className="bg-secondary border-0 h-10 rounded-xl flex-1"
                    />
                    {idlePlates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualVehicle(false)
                          setFormVehicle(editingDriver?.vehicle || "")
                        }}
                        className="h-10 text-xs font-bold text-primary px-3 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors"
                      >
                        Gunakan List
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Jenis Kendaraan</Label>
                <select
                  value={formVehicleType}
                  onChange={(e) => setFormVehicleType(e.target.value)}
                  className="w-full h-10 rounded-xl mt-1 bg-secondary border-0 px-3 text-sm text-foreground appearance-none"
                >
                  <option value="">Pilih jenis...</option>
                  <option value="CDE">CDE (Engkel)</option>
                  <option value="CDD">CDD (Double)</option>
                  <option value="Fuso">Fuso</option>
                  <option value="Tronton">Tronton</option>
                  <option value="Pickup">Pickup</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              {editingDriver && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => setFormStatus("aktif")}
                      className={cn(
                        "flex-1 h-10 rounded-xl text-sm font-medium transition-all",
                        formStatus === "aktif"
                          ? "bg-success/15 text-success border border-success/30"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      Aktif
                    </button>
                    <button
                      onClick={() => setFormStatus("nonaktif")}
                      className={cn(
                        "flex-1 h-10 rounded-xl text-sm font-medium transition-all",
                        formStatus === "nonaktif"
                          ? "bg-destructive/15 text-destructive border border-destructive/30"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      Tidak Aktif
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={resetForm}>
                Batal
              </Button>
              <Button
                className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground"
                onClick={handleSave}
                disabled={!formName.trim()}
              >
                {editingDriver ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal (Opsi B) */}
      {showDetail && detailDriver && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowDetail(false)} />
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

              {detailLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                  <p className="text-xs text-muted-foreground">Memuat data keuangan...</p>
                </div>
              ) : detailData ? (
                <div className="space-y-3.5">
                  {/* Setoran Section */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Setoran Trip</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-secondary/35">
                        <p className="text-[10px] text-muted-foreground">Wajib Setor</p>
                        <p className="font-semibold text-foreground mt-0.5">
                          Rp {detailData.deposits.summary.totalCompanyShare.toLocaleString("id-ID")}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-secondary/35 border-l-2 border-l-amber-500">
                        <p className="text-[10px] text-muted-foreground">Sisa Setoran</p>
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
                      <div className="p-2.5 rounded-xl bg-secondary/35">
                        <p className="text-[10px] text-muted-foreground">Total Kasbon</p>
                        <p className="font-semibold text-foreground mt-0.5">
                          Rp {detailData.debts.summary.totalDebt.toLocaleString("id-ID")}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-secondary/35 border-l-2 border-l-red-500">
                        <p className="text-[10px] text-muted-foreground">Sisa Kasbon</p>
                        <p className="font-bold text-red-500 mt-0.5">
                          Rp {detailData.debts.summary.totalRemaining.toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Total Tagihan */}
                  <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-destructive uppercase tracking-wide text-[10px]">
                        Total Kewajiban
                      </span>
                      <span className="font-extrabold text-sm text-destructive">
                        Rp {(detailData.deposits.summary.totalRemaining + detailData.debts.summary.totalRemaining).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
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
          </div>
        </div>
      )}
    </div>
    </PullToRefresh>
  )
}
