"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUser } from "@/lib/user-context"
import {
  Plus,
  Search,
  X,
  Car,
  FileText,
  ChevronRight,
  ChevronDown,
  Calendar,
  Pencil,
  Trash2,
  Loader2,
  History,
  FileCheck,
  AlertTriangle,
  User,
  Banknote,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface Document {
  id: number
  vehicle: string
  type: string
  expiry: string
  renewalCost: number
  created_at: string
}

interface Renewal {
  id: number
  document_id: number
  vehicle: string
  driver: string
  type: string
  previous_expiry: string
  new_expiry: string
  cost: number
  created_at: string
}

interface Driver {
  id: number
  name: string
  vehicle: string
  status: string
}

export default function DocumentsPage() {
  const router = useRouter()
  const { isAdmin, isAuthenticated } = useUser()

  // Tab state: 'pajak' | 'kir' | 'history'
  const [activeTab, setActiveTab] = useState<"pajak" | "kir" | "history">("pajak")

  // Data states
  const [documents, setDocuments] = useState<Document[]>([])
  const [renewals, setRenewals] = useState<Renewal[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)

  // Search state
  const [searchQuery, setSearchQuery] = useState("")

  // Form modal states
  const [showDocModal, setShowDocModal] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [renewingDoc, setRenewingDoc] = useState<Document | null>(null)

  // Form document inputs
  const [docVehicle, setDocVehicle] = useState("")
  const [docType, setDocType] = useState("KIR")
  const [customDocType, setCustomDocType] = useState("")
  const [docExpiry, setDocExpiry] = useState("")
  const [docCost, setDocCost] = useState("")

  // Form renewal inputs
  const [renewDriver, setRenewDriver] = useState("")
  const [renewExpiry, setRenewExpiry] = useState("")
  const [renewCost, setRenewCost] = useState("")

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

  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      router.push("/")
    }
  }, [isAuthenticated, isAdmin, router])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [resDocs, resRenewals, resDrivers] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/documents/renewals"),
        fetch("/api/drivers")
      ])

      if (resDocs.ok && resRenewals.ok && resDrivers.ok) {
        const docsData = await resDocs.json()
        const renewalsData = await resRenewals.json()
        const driversData = await resDrivers.json()

        setDocuments(docsData)
        setRenewals(renewalsData)
        setDrivers((driversData.drivers || []).filter((d: Driver) => d.status === "aktif"))
      }
    } catch (e) {
      console.error("Error fetching documents data:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchData()
    }
  }, [isAuthenticated, isAdmin])

  const handleRefresh = async () => {
    await fetchData()
  }

  // Days remaining logic
  const getDaysRemaining = (expiryDateStr: string) => {
    if (!expiryDateStr) return 0
    const expiry = new Date(expiryDateStr)
    const today = new Date()
    expiry.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    const diffTime = expiry.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const getExpiryStatus = (expiryDateStr: string) => {
    const days = getDaysRemaining(expiryDateStr)
    if (days <= 0) {
      return {
        label: days === 0 ? "Habis Hari Ini" : `Kedaluwarsa (${Math.abs(days)} hari lalu)`,
        colorClass: "bg-destructive/10 text-destructive border-destructive/20",
        alertIcon: true
      }
    } else if (days <= 30) {
      return {
        label: `Akan Habis (${days} hari lagi)`,
        colorClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        alertIcon: true
      }
    } else {
      return {
        label: `Aktif (${days} hari lagi)`,
        colorClass: "bg-success/10 text-success border-success/20",
        alertIcon: false
      }
    }
  }

  // Document saving
  const handleSaveDoc = async () => {
    const finalType = docType === "Lainnya" ? customDocType.trim() : docType
    if (!docVehicle.trim() || !finalType || !docExpiry) return

    const payload = {
      vehicle: docVehicle.trim().toUpperCase(),
      type: finalType,
      expiry: docExpiry,
      renewalCost: docCost ? parseInt(docCost) : 0,
      id: editingDoc?.id
    }

    try {
      const url = "/api/documents"
      const method = editingDoc ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        closeDocModal()
        fetchData()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteDoc = async (id: number) => {
    setConfirmDialog({
      open: true,
      title: "Hapus Dokumen?",
      message: "Apakah Anda yakin ingin menghapus dokumen ini? Semua riwayat perpanjangan terkait juga akan dihapus.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/documents?id=${id}`, {
            method: "DELETE"
          })

          if (res.ok) {
            fetchData()
          }
        } catch (e) {
          console.error(e)
        }
      }
    })
  }

  // Renewal saving
  const handleSaveRenewal = async () => {
    if (!renewingDoc || !renewDriver || !renewExpiry || !renewCost) return

    const payload = {
      document_id: renewingDoc.id,
      driver: renewDriver,
      new_expiry: renewExpiry,
      cost: parseInt(renewCost)
    }

    try {
      const res = await fetch("/api/documents/renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        closeRenewModal()
        fetchData()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteRenewal = async (id: number) => {
    setConfirmDialog({
      open: true,
      title: "Hapus Riwayat?",
      message: "Apakah Anda yakin ingin menghapus catatan riwayat perpanjangan ini?",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/documents/renewals?id=${id}`, {
            method: "DELETE"
          })

          if (res.ok) {
            fetchData()
          }
        } catch (e) {
          console.error(e)
        }
      }
    })
  }

  // Modal control helpers
  const openAddDocModal = () => {
    setEditingDoc(null)
    setDocVehicle("")
    if (activeTab === "pajak") {
      setDocType("Pajak")
    } else {
      setDocType("KIR")
    }
    setCustomDocType("")
    setDocExpiry("")
    setDocCost("")
    setShowDocModal(true)
  }

  const openEditDocModal = (doc: Document) => {
    setEditingDoc(doc)
    setDocVehicle(doc.vehicle)
    if (doc.type === "KIR" || doc.type === "Pajak") {
      setDocType(doc.type)
      setCustomDocType("")
    } else {
      setDocType("Lainnya")
      setCustomDocType(doc.type)
    }
    setDocExpiry(doc.expiry)
    setDocCost(doc.renewalCost ? String(doc.renewalCost) : "")
    setShowDocModal(true)
  }

  const closeDocModal = () => {
    setShowDocModal(false)
    setEditingDoc(null)
  }

  const openRenewModal = (doc: Document) => {
    setRenewingDoc(doc)
    // Find driver currently holding this vehicle
    const driverName = drivers.find(
      (d) => d.vehicle?.trim().toUpperCase() === doc.vehicle?.trim().toUpperCase()
    )?.name || "Admin"
    setRenewDriver(driverName)

    // Prefill with old expiry + 6 months for KIR, or + 1 year for Pajak
    const oldExpiry = new Date(doc.expiry)
    if (doc.type === "KIR") {
      oldExpiry.setMonth(oldExpiry.getMonth() + 6)
    } else {
      oldExpiry.setFullYear(oldExpiry.getFullYear() + 1)
    }
    setRenewExpiry(oldExpiry.toISOString().split("T")[0])
    setRenewCost(doc.renewalCost ? String(doc.renewalCost) : "")
    setShowRenewModal(true)
  }

  const closeRenewModal = () => {
    setShowRenewModal(false)
    setRenewingDoc(null)
  }

  // Filter logic
  const filteredDocuments = documents.filter((doc) => {
    const q = searchQuery.toLowerCase().trim()
    const matchesQuery = doc.vehicle.toLowerCase().includes(q)
    if (!matchesQuery) return false

    const docTypeLower = doc.type.toLowerCase()
    if (activeTab === "pajak") {
      return docTypeLower === "pajak"
    } else if (activeTab === "kir") {
      return docTypeLower === "kir"
    }
    return false
  })

  const filteredRenewals = renewals.filter((ren) => {
    const q = searchQuery.toLowerCase().trim()
    return (
      ren.vehicle.toLowerCase().includes(q) ||
      ren.type.toLowerCase().includes(q) ||
      ren.driver.toLowerCase().includes(q)
    )
  })

  if (!isAuthenticated || !isAdmin) return null

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen pb-24 bg-background">
        <MobileHeader title="Kelola Dokumen" showBack onBack={() => router.push("/")} />

        <div className="px-4 py-4 space-y-5">
          {/* Header Action Button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">
              {activeTab === "history"
                ? `${filteredRenewals.length} riwayat perpanjangan`
                : `${filteredDocuments.length} dokumen dipantau`}
            </p>
            {activeTab !== "history" && (
              <Button
                size="sm"
                className="rounded-xl bg-primary text-primary-foreground font-semibold"
                onClick={openAddDocModal}
              >
                <Plus className="h-4 w-4 mr-1" />
                Tambah
              </Button>
            )}
          </div>

          {/* Search bar & Tab filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={activeTab === "history" ? "Cari plat, jenis, atau supir..." : "Cari plat nomor..."}
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

            {/* Scrollable Main Tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 -mx-4 px-4">
              {[
                { key: "pajak", label: "Pajak STNK", icon: FileText },
                { key: "kir", label: "Uji KIR", icon: Car },
                { key: "history", label: "Riwayat", icon: History }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key as any)
                    setSearchQuery("")
                  }}
                  className={cn(
                    "text-xs font-semibold px-4 py-2.5 rounded-xl transition-all border flex items-center gap-1.5 shrink-0",
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-secondary text-muted-foreground border-transparent hover:border-border"
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* List render */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse border border-border/20" />
              ))}
            </div>
          ) : activeTab !== "history" ? (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => {
                const expiryInfo = getExpiryStatus(doc.expiry)
                return (
                  <Card
                    key={doc.id}
                    className="border border-border bg-card rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.015)] overflow-hidden"
                  >
                    <CardContent className="p-4 space-y-3.5">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2.5 rounded-xl bg-primary/10">
                            <Car className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <span className="text-sm font-bold text-foreground font-mono tracking-wide">{doc.vehicle}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={cn(
                                "text-[9px] font-bold px-1.5 py-0.2 rounded border",
                                doc.type === "Pajak"
                                  ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                  : "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                              )}>
                                {doc.type}
                              </span>
                              {doc.renewalCost > 0 && (
                                <span className="text-[9px] font-medium text-muted-foreground">
                                  Est: Rp {doc.renewalCost.toLocaleString("id-ID")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expiry Badge */}
                        <span className={cn(
                          "text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0",
                          expiryInfo.colorClass
                        )}>
                          {expiryInfo.label}
                        </span>
                      </div>

                      {/* Expiry Date Row */}
                      <div className="flex items-center justify-between text-xs border-t border-border/40 pt-3">
                        <div className="flex items-center gap-1 text-muted-foreground font-medium">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                          <span>Habis: {new Date(doc.expiry).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                        </div>

                        {/* Actions Row */}
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg text-xs font-semibold px-2.5 hover:bg-secondary text-foreground border-border"
                            onClick={() => openRenewModal(doc)}
                          >
                            Perpanjang
                          </Button>
                          <button
                            onClick={() => openEditDocModal(doc)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Edit Dokumen"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-red-400 hover:text-destructive transition-colors"
                            title="Hapus Dokumen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {filteredDocuments.length === 0 && (
                <div className="text-center py-16">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-60" />
                  <p className="text-muted-foreground text-sm font-medium">Dokumen tidak ditemukan</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRenewals.map((ren) => (
                <Card
                  key={ren.id}
                  className="border border-border bg-card rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.015)]"
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground font-mono">{ren.vehicle}</span>
                          <span className="text-[10px] font-bold text-primary px-1.5 py-0.5 bg-primary/10 rounded">
                            {ren.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <User className="h-3.5 w-3.5" />
                          <span>Pengurus: <strong className="text-foreground">{ren.driver}</strong></span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Banknote className="h-3.5 w-3.5" />
                          <span>Biaya: <strong>Rp {ren.cost.toLocaleString("id-ID")}</strong></span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteRenewal(ren.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-red-400 hover:text-destructive transition-colors"
                        title="Hapus Riwayat"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="bg-secondary/40 border border-border/30 rounded-xl p-2.5 text-[11px] flex justify-between items-center text-muted-foreground font-medium">
                      <span>Sebelum: {ren.previous_expiry ? new Date(ren.previous_expiry).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}</span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                      <span className="text-foreground font-bold">Baru: {new Date(ren.new_expiry).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredRenewals.length === 0 && (
                <div className="text-center py-16">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-60" />
                  <p className="text-muted-foreground text-sm font-medium">Belum ada riwayat perpanjangan</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal: Tambah/Edit Dokumen */}
        {showDocModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity" onClick={closeDocModal} />
            <div className="relative bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">
                  {editingDoc ? "Edit Dokumen" : "Tambah Dokumen"}
                </h3>
                <button onClick={closeDocModal} className="p-1 rounded-full hover:bg-secondary">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plat Kendaraan</Label>
                  <Input
                    value={docVehicle}
                    onChange={(e) => setDocVehicle(e.target.value)}
                    placeholder="Contoh: B 1234 ABC"
                    className="bg-card border border-border h-11 rounded-xl mt-1.5 focus-visible:ring-1 focus-visible:ring-primary/40 text-sm font-mono uppercase font-bold"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jenis Dokumen</Label>
                  <div className="relative mt-1.5">
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="w-full h-11 rounded-xl bg-card border border-border px-3 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      <option value="KIR">KIR</option>
                      <option value="Pajak">Pajak (STNK)</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tanggal Kedaluwarsa</Label>
                  <Input
                    type="date"
                    value={docExpiry}
                    onChange={(e) => setDocExpiry(e.target.value)}
                    className="bg-card border border-border h-11 rounded-xl mt-1.5 focus-visible:ring-1 focus-visible:ring-primary/40 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estimasi Biaya Perpanjangan</Label>
                  <Input
                    type="number"
                    value={docCost}
                    onChange={(e) => setDocCost(e.target.value)}
                    placeholder="Rp"
                    className="bg-card border border-border h-11 rounded-xl mt-1.5 focus-visible:ring-1 focus-visible:ring-primary/40 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-semibold" onClick={closeDocModal}>
                  Batal
                </Button>
                <Button
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm"
                  onClick={handleSaveDoc}
                  disabled={!docVehicle.trim() || !docExpiry}
                >
                  Simpan
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Perpanjang Dokumen */}
        {showRenewModal && renewingDoc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity" onClick={closeRenewModal} />
            <div className="relative bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">
                  Perpanjang Dokumen
                </h3>
                <button onClick={closeRenewModal} className="p-1 rounded-full hover:bg-secondary">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Prefilled doc details */}
                <div className="p-3 rounded-xl bg-secondary/50 border border-border flex justify-between items-center text-xs">
                  <div>
                    <p className="font-extrabold text-foreground font-mono">{renewingDoc.vehicle}</p>
                    <p className="text-muted-foreground mt-0.5">Dokumen: <strong>{renewingDoc.type}</strong></p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Kedaluwarsa lama:</p>
                    <p className="font-semibold text-foreground mt-0.5">
                      {new Date(renewingDoc.expiry).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tanggal Kedaluwarsa Baru</Label>
                  <Input
                    type="date"
                    value={renewExpiry}
                    onChange={(e) => setRenewExpiry(e.target.value)}
                    className="bg-card border border-border h-11 rounded-xl mt-1.5 focus-visible:ring-1 focus-visible:ring-primary/40 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Biaya Perpanjangan Aktual</Label>
                  <Input
                    type="number"
                    value={renewCost}
                    onChange={(e) => setRenewCost(e.target.value)}
                    placeholder="Rp"
                    className="bg-card border border-border h-11 rounded-xl mt-1.5 focus-visible:ring-1 focus-visible:ring-primary/40 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supir Pengurus</Label>
                  <Input
                    value={renewDriver}
                    readOnly
                    className="bg-secondary/40 border border-border h-11 rounded-xl mt-1.5 text-sm font-semibold text-foreground cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-semibold" onClick={closeRenewModal}>
                  Batal
                </Button>
                <Button
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm"
                  onClick={handleSaveRenewal}
                  disabled={!renewDriver || !renewExpiry || !renewCost}
                >
                  Simpan
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
          confirmText={confirmDialog.title.toLowerCase().includes("hapus") ? "Ya, Hapus" : "Ya, Lanjutkan"}
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
