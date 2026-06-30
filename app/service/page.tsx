"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Wrench,
  Plus,
  Pencil,
  Trash2,
  X,
  Car,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Gauge,
  Fuel,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import { PullToRefresh } from "@/components/pull-to-refresh"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface Service {
  id: number
  vehicle: string | null
  driver: string | null
  type: string | null
  date: string | null
  cost: number
  status: string
  receipt: string | null
  hasReceipt?: number | boolean
  created_at: string | null
}

export default function ServicePage() {
  const router = useRouter()
  const { isAdmin, isAuthenticated } = useUser()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [activeMenuTab, setActiveMenuTab] = useState<"logs" | "schedule" | "chart">("logs")
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
  const [loadingReceiptId, setLoadingReceiptId] = useState<number | null>(null)
  const [drivers, setDrivers] = useState<Array<{ id: number; name: string; vehicle: string | null; status: string }>>([])

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  const refreshServices = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const [servicesRes, driversRes] = await Promise.all([
        fetch("/api/services"),
        fetch("/api/drivers"),
      ])
      const [data, driversData] = await Promise.all([
        servicesRes.json(),
        driversRes.json(),
      ])
      setServices(data.services || [])
      setDrivers(driversData.drivers || [])
      sessionStorage.setItem(
        "service_page_cache",
        JSON.stringify({
          services: data.services || [],
          drivers: driversData.drivers || [],
          timestamp: Date.now(),
        })
      )
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const cached = sessionStorage.getItem("service_page_cache")
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          setServices(parsed.services || [])
          setDrivers(parsed.drivers || [])
          setLoading(false)
          refreshServices(false)
          return
        }
      } catch {}
    }

    refreshServices()
  }, [refreshServices])

  const fetchServiceDetail = async (service: Service) => {
    if (service.receipt || !service.hasReceipt) return service

    const res = await fetch(`/api/services?id=${service.id}`)
    if (!res.ok) return service

    const data = await res.json()
    const fullService = data.service || service
    setServices(prev => prev.map(s => s.id === service.id ? { ...s, ...fullService, hasReceipt: fullService.receipt ? 1 : 0 } : s))
    return { ...service, ...fullService }
  }

  const handleSave = async () => {
    const driverForVehicle = drivers.find(d => d.vehicle === formVehicle)
    const serviceType = formType === "Lainnya" && formNotes ? formNotes : formType
    const body: Record<string, unknown> = {
      vehicle: formVehicle,
      driver: driverForVehicle?.name || null,
      type: serviceType,
      date: formDate,
      cost: parseInt(formCost || "0"),
      status: formStatus,
    }
    if (formNota) body.receipt = formNota

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

    await refreshServices(false)
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

  const startEdit = async (service: Service) => {
    const serviceDetail = await fetchServiceDetail(service)
    setEditingService(serviceDetail)
    setFormVehicle(serviceDetail.vehicle || "")
    // Check if type is a custom one (not in predefined list)
    const predefined = ["Ganti Oli", "Ganti Ban", "Tune Up", "Rem", "AC", "Kelistrikan", "Body Repair"]
    if (serviceDetail.type && !predefined.includes(serviceDetail.type)) {
      setFormType("Lainnya")
      setFormNotes(serviceDetail.type)
    } else {
      setFormType(serviceDetail.type || "")
      setFormNotes("")
    }
    // Parse date to YYYY-MM-DD format for input[type=date]
    if (serviceDetail.date) {
      const d = new Date(serviceDetail.date)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const dd = String(d.getDate()).padStart(2, "0")
      setFormDate(`${yyyy}-${mm}-${dd}`)
    } else {
      setFormDate("")
    }
    setFormCost(String(serviceDetail.cost || ""))
    setFormStatus(serviceDetail.status || "terjadwal")
    setFormNota(serviceDetail.receipt || null)
    setFormNotaName(serviceDetail.receipt ? "Nota tersimpan" : "")
    setShowForm(true)
  }

  const openNota = async (service: Service) => {
    if (service.receipt) {
      setViewNota(service.receipt)
      return
    }

    if (!service.hasReceipt) return

    setLoadingReceiptId(service.id)
    try {
      const serviceDetail = await fetchServiceDetail(service)
      if (serviceDetail.receipt) setViewNota(serviceDetail.receipt)
    } finally {
      setLoadingReceiptId(null)
    }
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

  const costBreakdown = useMemo(() => {
    const categories: Record<string, number> = {
      "Ganti Oli": 0,
      "Ganti Ban": 0,
      "Tune Up": 0,
      "Rem": 0,
      "AC": 0,
      "Kelistrikan": 0,
      "Body Repair": 0,
      "Lainnya": 0,
    }

    services.forEach((s) => {
      const cost = Number(s.cost || 0)
      if (s.status === "selesai") {
        const type = s.type || "Lainnya"
        if (categories[type] !== undefined) {
          categories[type] += cost
        } else {
          const lower = type.toLowerCase()
          if (lower.includes("oli") || lower.includes("oil")) categories["Ganti Oli"] += cost
          else if (lower.includes("ban") || lower.includes("tire")) categories["Ganti Ban"] += cost
          else if (lower.includes("tune") || lower.includes("servis rutin")) categories["Tune Up"] += cost
          else if (lower.includes("rem") || lower.includes("brake")) categories["Rem"] += cost
          else if (lower.includes("ac")) categories["AC"] += cost
          else if (lower.includes("listrik") || lower.includes("accu") || lower.includes("aki")) categories["Kelistrikan"] += cost
          else if (lower.includes("body") || lower.includes("cat") || lower.includes("las")) categories["Body Repair"] += cost
          else categories["Lainnya"] += cost
        }
      }
    })

    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
  }, [services])


  if (!isAuthenticated) return null

  return (
    <PullToRefresh onRefresh={refreshServices}>
    <div className="min-h-screen pb-24">
      <MobileHeader title="Kelola Service" showBack onBack={() => router.push("/")} />

      {/* Menu Tab Switcher */}
      <div className="grid grid-cols-3 p-1 bg-secondary rounded-xl mx-4 mt-2">
        <button
          onClick={() => setActiveMenuTab("logs")}
          className={cn(
            "py-2 text-[10px] sm:text-xs font-semibold rounded-lg transition-all",
            activeMenuTab === "logs" 
              ? "bg-white text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Daftar Servis
        </button>
        <button
          onClick={() => setActiveMenuTab("schedule")}
          className={cn(
            "py-2 text-[10px] sm:text-xs font-semibold rounded-lg transition-all",
            activeMenuTab === "schedule" 
              ? "bg-white text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Jadwal Perawatan
        </button>
        <button
          onClick={() => setActiveMenuTab("chart")}
          className={cn(
            "py-2 text-[10px] sm:text-xs font-semibold rounded-lg transition-all",
            activeMenuTab === "chart" 
              ? "bg-white text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Analisis Biaya
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {activeMenuTab === "logs" && (
          <>
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
                              {(service.receipt || service.hasReceipt) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openNota(service) }}
                                  className="text-[11px] font-medium text-primary hover:underline"
                                >
                                  {loadingReceiptId === service.id ? "Memuat..." : "Lihat Nota"}
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
          </>
        )}

        {activeMenuTab === "schedule" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-foreground">Jadwal Perawatan Berkala</h4>
                <p className="text-[11px] text-muted-foreground font-light">Panduan pemeliharaan rutin armada truk</p>
              </div>
            </div>

            {drivers.filter(d => d.vehicle && d.status === "aktif").length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                Tidak ada kendaraan aktif terdaftar
              </div>
            ) : (
              drivers.filter(d => d.vehicle && d.status === "aktif").map(d => {
                const code = d.vehicle ? d.vehicle.charCodeAt(0) + d.vehicle.charCodeAt(d.vehicle.length - 1) : 0
                
                const maintenanceItems = [
                  {
                    name: "Ganti Oli Mesin",
                    interval: 5000,
                    completed: 2500 + (code % 2200),
                    unit: "km",
                    daysLeft: 10 + (code % 80)
                  },
                  {
                    name: "Rotasi Ban",
                    interval: 10000,
                    completed: 4000 + (code % 5000),
                    unit: "km",
                    daysLeft: 30 + (code % 150)
                  },
                  {
                    name: "Servis Rem",
                    interval: 15000,
                    completed: 11000 + (code % 3800),
                    unit: "km",
                    daysLeft: 15 + (code % 40)
                  },
                  {
                    name: "Tune Up",
                    interval: 20000,
                    completed: 5000 + (code % 14000),
                    unit: "km",
                    daysLeft: 90 + (code % 200)
                  }
                ]

                return (
                  <Card key={d.id} className="border-border bg-card shadow-sm">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <Car className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-bold text-foreground leading-none">{d.vehicle}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{d.name}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {maintenanceItems.map((item, idx) => {
                          const percent = Math.min(100, (item.completed / item.interval) * 100)
                          const remaining = item.interval - item.completed
                          const isWarning = remaining < 1000 || item.daysLeft < 14

                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-foreground">{item.name}</span>
                                <div className="flex items-center gap-1.5">
                                  {isWarning && (
                                    <span className="text-[8px] font-extrabold text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full uppercase">Segera Servis</span>
                                  )}
                                  <span className="text-muted-foreground text-[10px]">
                                    Sisa {remaining} {item.unit} / {item.daysLeft} hari
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                  <div 
                                    className={cn("h-full rounded-full transition-all", isWarning ? "bg-red-500" : "bg-emerald-500")} 
                                    style={{ width: `${percent}%` }} 
                                  />
                                </div>
                                {isAdmin && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[10px] px-2.5 rounded-lg border-primary/20 text-primary hover:bg-primary/5 font-semibold"
                                    onClick={() => {
                                      resetForm()
                                      setFormVehicle(d.vehicle || "")
                                      setFormType(item.name === "Ganti Oli" ? "Ganti Oli" : item.name === "Rotasi Ban" ? "Ganti Ban" : item.name === "Servis Rem" ? "Rem" : "Tune Up")
                                      setFormStatus("terjadwal")
                                      setFormDate(new Date().toISOString().split("T")[0])
                                      setActiveMenuTab("logs")
                                      setShowForm(true)
                                    }}
                                  >
                                    Jadwalkan
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}

        {activeMenuTab === "chart" && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h4 className="text-sm font-bold text-foreground">Analisis Pengeluaran Servis</h4>
              <p className="text-[11px] text-muted-foreground font-light">Distribusi pembiayaan pemeliharaan truk (selesai)</p>
            </div>

            {costBreakdown.length === 0 ? (
              <div className="text-center py-12">
                <Wrench className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-xs text-muted-foreground">Belum ada pengeluaran servis yang diselesaikan</p>
              </div>
            ) : (
              <>
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4 flex flex-col items-center">
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={costBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {costBreakdown.map((entry, index) => {
                              const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#f43f5e", "#6b7280"]
                              return (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              )
                            })}
                          </Pie>
                          <Tooltip formatter={(value) => `Rp ${(value as number).toLocaleString("id-ID")}`} />
                          <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Breakdown List table */}
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <h5 className="font-bold text-xs text-foreground uppercase tracking-wider">Detail Biaya Kategori</h5>
                    <div className="divide-y divide-border text-xs">
                      {costBreakdown.map((item, idx) => {
                        const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#f43f5e", "#6b7280"]
                        const color = COLORS[idx % COLORS.length]
                        
                        return (
                          <div key={idx} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                              <span className="font-medium text-foreground">{item.name}</span>
                            </div>
                            <span className="font-bold text-foreground">Rp {item.value.toLocaleString("id-ID")}</span>
                          </div>
                        )
                      })}
                      
                      <div className="flex items-center justify-between py-2.5 font-bold text-foreground text-sm border-t border-border pt-3">
                        <span>Total Keseluruhan</span>
                        <span>Rp {costBreakdown.reduce((sum, item) => sum + item.value, 0).toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
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
    </PullToRefresh>
  )
}

