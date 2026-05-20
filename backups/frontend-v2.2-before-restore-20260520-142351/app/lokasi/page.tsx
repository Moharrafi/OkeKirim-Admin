"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Search,
  MapPin,
  Car,
  Battery,
  Signal,
  Navigation,
  X,
  Phone,
  Maximize2,
  Locate,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react"
import { cn } from "@/lib/utils"

const VehicleMap = dynamic(() => import("@/components/vehicle-map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-muted rounded-xl">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Memuat peta...</p>
      </div>
    </div>
  ),
})

interface Vehicle {
  id: string
  driver: string
  plate: string
  status: string
  location: string
  area: string
  speed: number
  battery: number
  signal: number
  lastUpdate: string
  lat: number
  lng: number
}

function formatLastUpdate(isoString: string): string {
  if (!isoString) return "Tidak diketahui"
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Baru saja"
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} jam lalu`
  return `${Math.floor(diffHours / 24)} hari lalu`
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case "active":
      return { label: "Aktif", color: "bg-emerald-500", textColor: "text-emerald-500" }
    case "idle":
      return { label: "Diam", color: "bg-amber-500", textColor: "text-amber-500" }
    case "offline":
      return { label: "Offline", color: "bg-slate-400", textColor: "text-slate-400" }
    default:
      return { label: "Unknown", color: "bg-slate-400", textColor: "text-slate-400" }
  }
}

const getSignalBars = (signal: number) => {
  return (
    <div className="flex items-end gap-0.5">
      {[1, 2, 3, 4, 5].map((bar) => (
        <div
          key={bar}
          className={cn(
            "w-1 rounded-sm transition-colors",
            bar <= signal ? "bg-emerald-500" : "bg-muted",
            bar === 1 && "h-1",
            bar === 2 && "h-1.5",
            bar === 3 && "h-2",
            bar === 4 && "h-2.5",
            bar === 5 && "h-3"
          )}
        />
      ))}
    </div>
  )
}

export default function LokasiPage() {
  const router = useRouter()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [mapExpanded, setMapExpanded] = useState(false)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [fitAllMarkers, setFitAllMarkers] = useState(false)

  useEffect(() => {
    const isAuth = localStorage.getItem("isAuthenticated")
    if (isAuth !== "true") {
      router.push("/login")
    }
    // Restore cached vehicles data if available (prevents reload on back navigation)
    const cached = sessionStorage.getItem("gps_vehicles")
    if (cached) {
      try {
        const { vehicles: cachedVehicles, timestamp } = JSON.parse(cached)
        // Use cache if less than 60 seconds old
        if (Date.now() - timestamp < 60000 && cachedVehicles.length > 0) {
          setVehicles(cachedVehicles)
          setLastFetch(new Date(timestamp))
          setLoading(false)
          return
        }
      } catch {}
    }
  }, [router])

  const fetchVehicles = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else if (vehicles.length === 0) setLoading(true)
    setError(null)

    try {
      const resp = await fetch("/api/gps")
      const data = await resp.json()

      if (!resp.ok) {
        setError(data.error || "Gagal mengambil data GPS")
        return
      }

      const mapped: Vehicle[] = (data.vehicles || [])
        .map((v: { id: string; name: string; plate: string; status: string; speed: number; lat: number; lng: number; lastUpdate: string; address?: string }) => ({
          id: v.id,
          driver: v.name,
          plate: v.plate || "-",
          status: v.status,
          location: v.address || (v.lat !== 0 ? "Memuat lokasi..." : "Tidak ada sinyal GPS"),
          area: "",
          speed: Math.round(v.speed),
          battery: 0,
          signal: v.status === "offline" ? 0 : v.status === "idle" ? 3 : 5,
          lastUpdate: formatLastUpdate(v.lastUpdate),
          lat: v.lat,
          lng: v.lng,
        }))

      setVehicles(mapped)
      setLastFetch(new Date())
      // Cache for back navigation
      sessionStorage.setItem("gps_vehicles", JSON.stringify({ vehicles: mapped, timestamp: Date.now() }))

      // Geocode addresses in background
      for (const v of mapped) {
        if (v.lat !== 0 && v.lng !== 0 && v.location === "Memuat lokasi...") {
          fetch(`/api/geocode?lat=${v.lat}&lng=${v.lng}`)
            .then(r => r.json())
            .then(d => {
              setVehicles(prev => prev.map(pv =>
                pv.id === v.id ? { ...pv, location: d.address } : pv
              ))
            })
            .catch(() => {})
        }
      }
    } catch (err) {
      setError("Gagal terhubung ke server GPS")
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchVehicles()
    // Auto-refresh setiap 30 detik
    const interval = setInterval(() => fetchVehicles(true), 30000)
    return () => clearInterval(interval)
  }, [fetchVehicles])

  const handleMarkerClick = (vehicleId: string) => {
    // Klik dari map: hanya zoom ke marker, tidak munculkan popup detail
    setSelectedVehicle(null)
  }

  const handleListClick = (vehicleId: string) => {
    // Klik dari daftar kendaraan: munculkan popup detail
    setSelectedVehicle(vehicleId)
  }

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.driver.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.plate.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = activeFilter === "all" || v.status === activeFilter
    return matchesSearch && matchesFilter
  })

  const selectedVehicleData = vehicles.find((v) => v.id === selectedVehicle)
  const statusCounts = {
    all: vehicles.length,
    active: vehicles.filter((v) => v.status === "active").length,
    idle: vehicles.filter((v) => v.status === "idle").length,
    offline: vehicles.filter((v) => v.status === "offline").length,
  }

  return (
    <div className="min-h-screen pb-24">
      <MobileHeader title="Lokasi Kendaraan" />

      <div className={cn(
        "px-4 py-4 space-y-4 transition-all duration-200",
        selectedVehicleData && "blur-sm pointer-events-none"
      )}>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari driver atau plat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-card border-border pl-11 h-12 rounded-xl"
          />
        </div>

        {/* GPS Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {error ? (
              <WifiOff className="h-3.5 w-3.5 text-red-500" />
            ) : (
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
            )}
            <span>
              {error
                ? "GPS Offline"
                : lastFetch
                  ? `GlonassSoft • Update ${lastFetch.toLocaleTimeString("id-ID")}`
                  : "Menghubungkan..."}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => fetchVehicles(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Mengambil data GPS dari GlonassSoft...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
            <CardContent className="p-4 text-center">
              <WifiOff className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fetchVehicles()}
              >
                Coba Lagi
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          {[
            { key: "all", label: "Semua" },
            { key: "active", label: "Aktif" },
            { key: "idle", label: "Diam" },
            { key: "offline", label: "Offline" },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => {
                setActiveFilter(filter.key)
                if (filter.key === "all") {
                  setFitAllMarkers(true)
                  setSelectedVehicle(null)
                }
              }}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all",
                activeFilter === filter.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {filter.label}
              <span className="ml-1.5 opacity-70">
                {statusCounts[filter.key as keyof typeof statusCounts]}
              </span>
            </button>
          ))}
        </div>

        {/* Map */}
        <Card
          className={cn(
            "border-border bg-card overflow-hidden transition-all duration-300",
            mapExpanded && "!fixed !inset-0 !z-[9999] !m-0 !rounded-none !border-0"
          )}
        >
          <div className={cn("relative w-full", mapExpanded ? "h-screen" : "h-72")}>
            <VehicleMap
              vehicles={filteredVehicles}
              selectedVehicle={selectedVehicle}
              onMarkerClick={handleMarkerClick}
              expanded={mapExpanded}
              fitAll={fitAllMarkers}
              onFitComplete={() => setFitAllMarkers(false)}
            />

            {/* Map Controls */}
            <div className="absolute top-3 right-3 flex flex-col gap-2 z-[10000] pointer-events-auto">
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-md border-0"
                onClick={() => setMapExpanded(!mapExpanded)}
              >
                {mapExpanded ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-3 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-md z-[10000] pointer-events-auto">
              {["active", "idle", "offline"].map((status) => {
                const config = getStatusConfig(status)
                return (
                  <div key={status} className="flex items-center gap-1.5 text-xs">
                    <span className={cn("h-2 w-2 rounded-full", config.color)} />
                    <span className="text-slate-600 dark:text-slate-300">{config.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        {/* Vehicle List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Daftar Kendaraan</h3>
            <span className="text-sm text-muted-foreground">
              {filteredVehicles.length} kendaraan
            </span>
          </div>

          {filteredVehicles.map((vehicle) => {
            const statusConfig = getStatusConfig(vehicle.status)
            return (
              <Card
                key={vehicle.id}
                className={cn(
                  "border-border bg-card transition-all cursor-pointer hover:border-primary/50",
                  selectedVehicle === vehicle.id && "border-primary ring-2 ring-primary/20"
                )}
                onClick={() => handleListClick(vehicle.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar
                        className="h-12 w-12 flex-shrink-0 ring-2 ring-offset-2 ring-offset-background"
                        style={{
                          // @ts-expect-error - custom ring color
                          "--tw-ring-color":
                            vehicle.status === "active"
                              ? "rgb(16 185 129)"
                              : vehicle.status === "idle"
                                ? "rgb(245 158 11)"
                                : "rgb(148 163 184)",
                        }}
                      >
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {vehicle.driver
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      {vehicle.status === "active" && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                          <Navigation className="h-2 w-2 text-white" />
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-foreground truncate">{vehicle.driver}</p>
                        <div
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                            vehicle.status === "active" &&
                              "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                            vehicle.status === "idle" &&
                              "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                            vehicle.status === "offline" &&
                              "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig.color)} />
                          {statusConfig.label}
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">{vehicle.plate}</p>

                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                        <span className="truncate">{vehicle.location}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary">
                            <Navigation className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <span className="text-foreground font-medium">{vehicle.speed}</span>
                          <span className="text-muted-foreground">km/h</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs">
                          <div
                            className={cn(
                              "flex items-center justify-center w-6 h-6 rounded-full",
                              vehicle.battery > 50
                                ? "bg-emerald-500/10"
                                : vehicle.battery > 20
                                  ? "bg-amber-500/10"
                                  : "bg-red-500/10"
                            )}
                          >
                            <Battery
                              className={cn(
                                "h-3 w-3",
                                vehicle.battery > 50
                                  ? "text-emerald-500"
                                  : vehicle.battery > 20
                                    ? "text-amber-500"
                                    : "text-red-500"
                              )}
                            />
                          </div>
                          <span className="text-foreground font-medium">{vehicle.battery}%</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary">
                            <Signal className="h-3 w-3 text-muted-foreground" />
                          </div>
                          {getSignalBars(vehicle.signal)}
                        </div>

                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                          <Clock className="h-3 w-3" />
                          {vehicle.lastUpdate}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        </>
        )}
      </div>

      {/* Vehicle Detail Sheet */}
      {selectedVehicleData && (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 z-[55] bg-black/20 animate-in fade-in duration-200"
            onClick={() => setSelectedVehicle(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[60] pb-20 animate-in slide-in-from-bottom-4 duration-300">
          <Card className="mx-4 border-border bg-card shadow-2xl">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-14 w-14">
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                        {selectedVehicleData.driver
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-background flex items-center justify-center",
                        getStatusConfig(selectedVehicleData.status).color
                      )}
                    >
                      {selectedVehicleData.status === "active" ? (
                        <Navigation className="h-2.5 w-2.5 text-white" />
                      ) : (
                        <Car className="h-2.5 w-2.5 text-white" />
                      )}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-lg text-foreground">
                      {selectedVehicleData.driver}
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedVehicleData.plate}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 -mt-1 -mr-1 rounded-full"
                  onClick={() => setSelectedVehicle(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50 mb-4">
                <MapPin className="h-5 w-5 flex-shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {selectedVehicleData.location}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedVehicleData.area} - Diperbarui {selectedVehicleData.lastUpdate}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-2 rounded-xl bg-secondary/50">
                  <p className="text-lg font-bold text-foreground">{selectedVehicleData.speed}</p>
                  <p className="text-xs text-muted-foreground">km/h</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-secondary/50">
                  <p className="text-lg font-bold text-foreground">
                    {selectedVehicleData.battery}%
                  </p>
                  <p className="text-xs text-muted-foreground">Baterai</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-secondary/50">
                  <p className="text-lg font-bold text-foreground">
                    {selectedVehicleData.signal}/5
                  </p>
                  <p className="text-xs text-muted-foreground">Sinyal</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-11 rounded-xl border-border text-xs sm:text-sm px-2">
                  <Phone className="h-4 w-4 mr-1 shrink-0" />
                  <span className="truncate">Telepon</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl border-border text-xs sm:text-sm px-2"
                  onClick={() => {
                    router.push(`/lokasi/history?id=${selectedVehicleData.id}&name=${encodeURIComponent(selectedVehicleData.driver)}`)
                  }}
                >
                  <Clock className="h-4 w-4 mr-1 shrink-0" />
                  <span className="truncate">History</span>
                </Button>
                <Button
                  className="h-11 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm px-2"
                  onClick={() => {
                    if (selectedVehicleData && selectedVehicleData.lat !== 0) {
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${selectedVehicleData.lat},${selectedVehicleData.lng}`,
                        "_blank"
                      )
                    }
                  }}
                >
                  <Navigation className="h-4 w-4 mr-1 shrink-0" />
                  <span className="truncate">Navigasi</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        </>
      )}
    </div>
  )
}
