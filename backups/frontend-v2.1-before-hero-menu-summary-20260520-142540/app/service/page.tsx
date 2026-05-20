"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Wrench, Plus, Pencil, Trash2, X, Car, Calendar, CheckCircle2, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"

interface Service {
  id: number
  vehicle: string | null
  driver: string | null
  type: string | null
  date: string | null
  cost: number
  status: string
  receipt: string | null
  created_at: string | null
}

export default function ServicePage() {
  const router = useRouter()
  const { isAdmin, isAuthenticated } = useUser()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [formVehicle, setFormVehicle] = useState("")
  const [formType, setFormType] = useState("")
  const [formDate, setFormDate] = useState("")
  const [formCost, setFormCost] = useState("")
  const [formStatus, setFormStatus] = useState("terjadwal")
  const [formNota, setFormNota] = useState<string | null>(null)
  const [formNotaName, setFormNotaName] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [filter, setFilter] = useState<"active" | "done">("active")
  const [viewNota, setViewNota] = useState<string | null>(null)
  const [drivers, setDrivers] = useState<Array<{ id: number; name: string; vehicle: string | null; status: string }>>([])

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  useEffect(() => {
    fetch("/api/services")
      .then(r => r.json())
      .then(data => setServices(data.services || []))
      .catch(() => {})
      .finally(() => setLoading(false))
    // Fetch drivers for vehicle dropdown
    fetch("/api/drivers")
      .then(r => r.json())
      .then(data => setDrivers(data.drivers || []))
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    const driverForVehicle = drivers.find(d => d.vehicle === formVehicle)
    const serviceType = formType === "Lainnya" && formNotes ? formNotes : formType
    const body = {
      vehicle: formVehicle,
      driver: driverForVehicle?.name || null,
      type: serviceType,
      date: formDate,
      cost: parseInt(formCost || "0"),
      status: formStatus,
      receipt: formNota || undefined,
    }

    if (editingService) {
      await fetch("/api/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, id: editingService.id }),
      })
    } else {
      await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    }

    const res = await fetch("/api/services")
    const data = await res.json()
    setServices(data.services || [])
    // If status changed to selesai, switch to selesai tab
    if (editingService && formStatus === "selesai" && editingService.status !== "selesai") {
      setFilter("done")
    }
    resetForm()
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus service ini?")) return
    await fetch("/api/services", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setServices(prev => prev.filter(s => s.id !== id))
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingService(null)
    setFormVehicle("")
    setFormType("")
    setFormDate("")
    setFormCost("")
    setFormStatus("terjadwal")
    setFormNota(null)
    setFormNotaName("")
    setFormNotes("")
  }

  const startEdit = (service: Service) => {
    setEditingService(service)
    setFormVehicle(service.vehicle || "")
    // Check if type is a custom one (not in predefined list)
    const predefined = ["Ganti Oli", "Ganti Ban", "Tune Up", "Rem", "AC", "Kelistrikan", "Body Repair"]
    if (service.type && !predefined.includes(service.type)) {
      setFormType("Lainnya")
      setFormNotes(service.type)
    } else {
      setFormType(service.type || "")
      setFormNotes("")
    }
    // Parse date to YYYY-MM-DD format for input[type=date]
    if (service.date) {
      const d = new Date(service.date)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const dd = String(d.getDate()).padStart(2, "0")
      setFormDate(`${yyyy}-${mm}-${dd}`)
    } else {
      setFormDate("")
    }
    setFormCost(String(service.cost || ""))
    setFormStatus(service.status || "terjadwal")
    setFormNota(service.receipt || null)
    setFormNotaName(service.receipt ? "Nota tersimpan" : "")
    setShowForm(true)
  }

  const handleNotaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormNotaName(file.name)
      const reader = new FileReader()
      reader.onload = (ev) => {
        const img = new window.Image()
        img.onload = () => {
          const canvas = document.createElement("canvas")
          const maxSize = 600
          let { width, height } = img
          if (width > maxSize || height > maxSize) {
            if (width > height) { height = (height / width) * maxSize; width = maxSize }
            else { width = (width / height) * maxSize; height = maxSize }
          }
          canvas.width = width
          canvas.height = height
          canvas.getContext("2d")?.drawImage(img, 0, 0, width, height)
          setFormNota(canvas.toDataURL("image/jpeg", 0.6))
        }
        img.src = ev.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  const [filterDriver, setFilterDriver] = useState("")

  const filteredServices = services.filter(s => {
    const statusMatch = filter === "active" ? s.status !== "selesai" : s.status === "selesai"
    const driverMatch = !filterDriver || s.driver === filterDriver || s.vehicle === filterDriver
    return statusMatch && driverMatch
  })

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen pb-24">
      <MobileHeader title="Kelola Service" showBack onBack={() => router.push("/")} />

      <div className="px-4 py-4 space-y-4">
        {/* Filter + Add */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(["active", "done"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-full transition-all",
                  filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}
              >
                {f === "active" ? "Berlangsung" : "Selesai"}
              </button>
            ))}
          </div>
          {isAdmin && (
            <Button size="sm" className="rounded-xl bg-primary text-primary-foreground" onClick={() => { resetForm(); setShowForm(true) }}>
              <Plus className="h-4 w-4 mr-1" />
              Tambah
            </Button>
          )}
        </div>

        {/* Filter by driver - only on Selesai tab */}
        {filter === "done" && (
          <select
            value={filterDriver}
            onChange={(e) => setFilterDriver(e.target.value)}
            className="w-full h-10 rounded-xl bg-card border border-border px-3 text-sm text-foreground"
          >
            <option value="">Semua Kendaraan</option>
            {drivers.filter(d => d.vehicle && d.status === "aktif").map(d => (
              <option key={d.id} value={d.vehicle!}>{d.vehicle} — {d.name}</option>
            ))}
          </select>
        )}

        {/* Service List */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />)}
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <Wrench className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Tidak ada data service</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredServices.map((service) => (
              <Card key={service.id} className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2.5 rounded-xl",
                        service.status === "selesai" ? "bg-success/10" : "bg-warning/10"
                      )}>
                        {service.status === "selesai"
                          ? <CheckCircle2 className="h-5 w-5 text-success" />
                          : <Clock className="h-5 w-5 text-warning" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{service.type || "Service"}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Car className="h-3 w-3" />
                            {service.vehicle || "-"}
                          </span>
                          {service.driver && (
                            <span className="text-xs text-muted-foreground">• {service.driver}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          {service.date && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(service.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          )}
                          {service.cost > 0 && (
                            <span className="text-[11px] font-semibold text-foreground">
                              Rp {service.cost.toLocaleString("id-ID")}
                            </span>
                          )}
                          {service.receipt && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setViewNota(service.receipt) }}
                              className="text-[11px] font-medium text-primary hover:underline"
                            >
                              Lihat Nota
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(service)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(service.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-red-400 hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* View Nota Modal */}
      {viewNota && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70" onClick={() => setViewNota(null)} />
          <div className="relative w-full max-w-sm animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setViewNota(null)}
              className="absolute -top-12 right-0 p-2 rounded-full bg-card text-foreground shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
            {viewNota.startsWith("data:") ? (
              <img src={viewNota} alt="Nota Service" className="w-full rounded-2xl shadow-2xl" />
            ) : viewNota.startsWith("http") ? (
              <img src={viewNota} alt="Nota Service" className="w-full rounded-2xl shadow-2xl" />
            ) : (
              <img src={`https://okekirim-admin-production.up.railway.app/${viewNota}`} alt="Nota Service" className="w-full rounded-2xl shadow-2xl" />
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={resetForm} />
          <div className="relative bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">
                {editingService ? "Edit Service" : "Tambah Service"}
              </h3>
              <button onClick={resetForm} className="p-1 rounded-full hover:bg-secondary">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Kendaraan</Label>
                <select value={formVehicle} onChange={(e) => setFormVehicle(e.target.value)} className="w-full h-10 rounded-xl mt-1 bg-secondary border-0 px-3 text-sm text-foreground">
                  <option value="">Pilih kendaraan...</option>
                  {drivers.filter(d => d.vehicle && d.status === "aktif").map(d => (
                    <option key={d.id} value={d.vehicle!}>{d.vehicle} — {d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Jenis Service</Label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full h-10 rounded-xl mt-1 bg-secondary border-0 px-3 text-sm text-foreground">
                  <option value="">Pilih jenis...</option>
                  <option value="Ganti Oli">Ganti Oli</option>
                  <option value="Ganti Ban">Ganti Ban</option>
                  <option value="Tune Up">Tune Up</option>
                  <option value="Rem">Rem</option>
                  <option value="AC">AC</option>
                  <option value="Kelistrikan">Kelistrikan</option>
                  <option value="Body Repair">Body Repair</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              {formType === "Lainnya" && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Keterangan Perbaikan</Label>
                  <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Jelaskan jenis perbaikan..." className="bg-secondary border-0 h-10 rounded-xl mt-1" />
                </div>
              )}
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Tanggal</Label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="bg-secondary border-0 h-10 rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Biaya</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                  <Input type="number" value={formCost} onChange={(e) => setFormCost(e.target.value)} placeholder="0" className="bg-secondary border-0 h-10 rounded-xl mt-1 pl-9" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Nota / Kwitansi</Label>
                {formNota && formNota.startsWith("data:") ? (
                  <div className="mt-1 space-y-2">
                    <div className="rounded-xl overflow-hidden border border-border">
                      <img src={formNota} alt="Nota" className="w-full h-32 object-cover" />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-success/10 border border-success/20">
                      <span className="text-xs text-success font-medium truncate">{formNotaName}</span>
                      <button onClick={() => { setFormNota(null); setFormNotaName("") }} className="p-1 rounded-full hover:bg-secondary">
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ) : formNotaName ? (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-success/10 border border-success/20 mt-1">
                    <span className="text-xs text-success font-medium truncate">{formNotaName}</span>
                    <button onClick={() => { setFormNota(null); setFormNotaName("") }} className="p-1 rounded-full hover:bg-secondary">
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center h-10 rounded-xl mt-1 bg-secondary border border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors">
                    <span className="text-xs text-muted-foreground">Upload foto nota...</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleNotaUpload} />
                  </label>
                )}
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                <div className="flex gap-2 mt-1">
                  {["terjadwal", "selesai"].map(s => (
                    <button
                      key={s}
                      onClick={() => setFormStatus(s)}
                      className={cn(
                        "flex-1 h-9 rounded-xl text-xs font-medium transition-all",
                        formStatus === s
                          ? s === "selesai" ? "bg-success/15 text-success border border-success/30"
                            : "bg-warning/15 text-warning border border-warning/30"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {s === "terjadwal" ? "Berlangsung" : "Selesai"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={resetForm}>Batal</Button>
              <Button className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground" onClick={handleSave} disabled={!formType}>
                {editingService ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

