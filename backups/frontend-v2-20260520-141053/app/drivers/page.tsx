"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Users, Plus, Pencil, Trash2, X, Car } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import { fetchDrivers, type Driver } from "@/lib/okekirim-api"

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

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
    if (!isAdmin) router.push("/")
  }, [isAuthenticated, isAdmin, router])

  useEffect(() => {
    fetchDrivers().then((d) => { setDrivers(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

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
    const updated = await fetchDrivers()
    setDrivers(updated)
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
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingDriver(null)
    setFormName("")
    setFormVehicle("")
    setFormVehicleType("")
    setFormStatus("aktif")
  }

  const startEdit = (driver: Driver) => {
    setEditingDriver(driver)
    setFormName(driver.name)
    setFormVehicle(driver.vehicle || "")
    setFormVehicleType(driver.vehicleType || "")
    setFormStatus(driver.status || "aktif")
    setShowForm(true)
  }

  if (!isAuthenticated || !isAdmin) return null

  return (
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
              <Card key={driver.id} className="border-border bg-card">
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
                        onClick={() => startEdit(driver)}
                        className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(driver.id)}
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
                <Input
                  value={formVehicle}
                  onChange={(e) => setFormVehicle(e.target.value)}
                  placeholder="Contoh: B 1234 ABC"
                  className="bg-secondary border-0 h-10 rounded-xl mt-1"
                />
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
    </div>
  )
}
