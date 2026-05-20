"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  MapPin,
  Navigation,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Route,
  Gauge,
  Timer,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Trip {
  startTime: string
  endTime: string
  startAddress: string
  endAddress: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  distance: number
  duration: number
  maxSpeed: number
  avgSpeed: number
}

interface HistoryData {
  vehicle: string
  date: string
  trips: Trip[]
  parkedLocation?: {
    address: string
    lat: number
    lng: number
    since: string
    until: string
  } | null
  totalDistance: number
  totalDuration: number
  totalPoints: number
  message?: string
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} menit`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}j ${mins}m` : `${hours} jam`
}

export default function VehicleHistoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const vehicleId = searchParams.get("id") || ""
  const vehicleName = searchParams.get("name") || ""

  const [historyData, setHistoryData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0]
  })

  useEffect(() => {
    if (!vehicleId) return
    fetchHistory()
  }, [vehicleId, selectedDate])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const resp = await fetch(
        `/api/gps/history?vehicleId=${vehicleId}&date=${selectedDate}`
      )
      const data = await resp.json()
      setHistoryData(data)

      // Geocode addresses in background after data loads
      if (data.trips && data.trips.length > 0) {
        for (let i = 0; i < data.trips.length; i++) {
          const trip = data.trips[i]
          // Geocode start
          if (!trip.startAddress && trip.startLat) {
            fetch(`/api/geocode?lat=${trip.startLat}&lng=${trip.startLng}`)
              .then(r => r.json())
              .then(d => {
                setHistoryData(prev => {
                  if (!prev) return prev
                  const updated = { ...prev, trips: [...prev.trips] }
                  updated.trips[i] = { ...updated.trips[i], startAddress: d.address }
                  return updated
                })
              })
              .catch(() => {})
          }
          // Geocode end
          if (!trip.endAddress && trip.endLat) {
            fetch(`/api/geocode?lat=${trip.endLat}&lng=${trip.endLng}`)
              .then(r => r.json())
              .then(d => {
                setHistoryData(prev => {
                  if (!prev) return prev
                  const updated = { ...prev, trips: [...prev.trips] }
                  updated.trips[i] = { ...updated.trips[i], endAddress: d.address }
                  return updated
                })
              })
              .catch(() => {})
          }
        }
      }

      // Geocode parked location
      if (data.parkedLocation && !data.parkedLocation.address) {
        fetch(`/api/geocode?lat=${data.parkedLocation.lat}&lng=${data.parkedLocation.lng}`)
          .then(r => r.json())
          .then(d => {
            setHistoryData(prev => {
              if (!prev || !prev.parkedLocation) return prev
              return { ...prev, parkedLocation: { ...prev.parkedLocation, address: d.address } }
            })
          })
          .catch(() => {})
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const changeDate = (offset: number) => {
    const current = new Date(selectedDate)
    current.setDate(current.getDate() + offset)
    // Don't allow future dates
    if (current > new Date()) return
    setSelectedDate(current.toISOString().split("T")[0])
  }

  const isToday = selectedDate === new Date().toISOString().split("T")[0]

  return (
    <div className="min-h-screen pb-24">
      <MobileHeader
        title={`Riwayat ${vehicleName || "Kendaraan"}`}
        showBack
        onBack={() => router.back()}
      />

      <div className="px-4 py-4 space-y-4">
        {/* Date Selector */}
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => changeDate(-1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {isToday ? "Hari Ini" : formatDate(selectedDate)}
                  </p>
                  {isToday && (
                    <p className="text-xs text-muted-foreground">
                      {formatDate(selectedDate)}
                    </p>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => changeDate(1)}
                disabled={isToday}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Mengambil riwayat perjalanan...
              </p>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {!loading && historyData && historyData.trips.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border bg-card">
              <CardContent className="p-3 text-center">
                <Route className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">
                  {(historyData.totalDistance || 0).toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">km</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-3 text-center">
                <Timer className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">
                  {formatDuration(historyData.totalDuration)}
                </p>
                <p className="text-xs text-muted-foreground">durasi</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-3 text-center">
                <Navigation className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">
                  {historyData.trips.length}
                </p>
                <p className="text-xs text-muted-foreground">perjalanan</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Trip List */}
        {!loading && historyData && historyData.trips.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">Detail Perjalanan</h3>

            {historyData.trips.map((trip, index) => (
              <Card key={index} className="border-border bg-card">
                <CardContent className="p-4">
                  {/* Time header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-primary">
                        {formatTime(trip.startTime)} - {formatTime(trip.endTime)}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 px-2 py-1 rounded-full">
                      {formatDuration(trip.duration)}
                    </span>
                  </div>

                  {/* Route */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <div className="w-0.5 h-10 bg-border" />
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Dari</p>
                        <p className="text-sm font-medium text-foreground">
                          {trip.startAddress || `Memuat lokasi...`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Ke</p>
                        <p className="text-sm font-medium text-foreground">
                          {trip.endAddress || `Memuat lokasi...`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Route className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-foreground">
                        {(trip.distance || 0).toFixed(1)} km
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Gauge className="h-3.5 w-3.5 text-amber-500" />
                      <span className="font-medium text-foreground">
                        Maks {trip.maxSpeed} km/h
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Navigation className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-medium text-foreground">
                        Rata {trip.avgSpeed} km/h
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State / Parked Location */}
        {!loading && historyData && historyData.trips.length === 0 && (
          <div className="space-y-4">
            {historyData.parkedLocation ? (
              <Card className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-full bg-amber-500/10">
                      <MapPin className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Kendaraan Parkir</p>
                      <p className="text-xs text-muted-foreground">Tidak ada perjalanan pada tanggal ini</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-secondary/50">
                    <p className="text-sm font-medium text-foreground">
                      {historyData.parkedLocation.address}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatTime(historyData.parkedLocation.since)} - {formatTime(historyData.parkedLocation.until)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-16">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                  <MapPin className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">Tidak ada data</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tidak ada data GPS untuk tanggal ini
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
