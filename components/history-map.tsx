"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, Eye, EyeOff, Gauge, Clock, Maximize2, Minimize2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavPoint {
  lat: number
  lng: number
  speed: number
  timestamp: string
}

interface HistoryMapProps {
  points: NavPoint[]
}

// Menghitung bearing (sudut rotasi) antara dua titik koordinat
function getBearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const lat1Rad = (lat1 * Math.PI) / 180
  const lat2Rad = (lat2 * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2Rad)
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)
  const brng = (Math.atan2(y, x) * 180) / Math.PI
  return (brng + 360) % 360
}

// Membuat ikon kustom penanda mobil yang memutar rotasinya sesuai bearing
function createCarIcon(bearing: number) {
  const html = `
    <div style="
      transform: rotate(${bearing}deg); 
      transition: transform 0.1s linear; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      width: 32px; 
      height: 32px;
    ">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Segitiga penunjuk arah navigasi premium -->
        <path d="M12 2L22 22L12 18L2 22L12 2Z" fill="#3b82f6" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    </div>
  `
  return L.divIcon({
    html: html,
    className: "car-playback-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

// Mengatur fokus kamera agar merentang pas ke seluruh jalur rute
function FitRouteBounds({ points }: { points: NavPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (!points || points.length === 0) return
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [points, map])
  return null
}

// Menyelaraskan pergerakan kamera agar mengikuti penanda mobil yang bergerak
function FollowMarker({ lat, lng, active }: { lat: number; lng: number; active: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (active && lat && lng) {
      map.panTo([lat, lng], { animate: true, duration: 0.2 })
    }
  }, [lat, lng, active, map])
  return null
}

function InvalidateMapSize({ trigger }: { trigger: any }) {
  const map = useMap()
  useEffect(() => {
    const timeout = setTimeout(() => {
      map.invalidateSize()
    }, 200)
    return () => clearTimeout(timeout)
  }, [trigger, map])
  return null
}

export default function HistoryMap({ points }: HistoryMapProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1) // 1x, 2x, 4x, 8x
  const [autoFollow, setAutoFollow] = useState(true)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [mapKey, setMapKey] = useState("history-map-init")

  useEffect(() => {
    setMapKey("history-map-mounted")
  }, [])

  // Mengunci scroll halaman saat peta layar penuh aktif
  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isFullScreen])

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Memetakan koordinat jalur rute
  const pathPositions = useMemo(() => {
    return points.map((p) => [p.lat, p.lng] as [number, number])
  }, [points])

  const currentPoint = points[currentIndex] || points[0] || null

  // Menghitung bearing dinamis kendaraan
  const bearing = useMemo(() => {
    if (points.length < 2 || currentIndex >= points.length - 1) return 0
    const p1 = points[currentIndex]
    const p2 = points[currentIndex + 1]
    return getBearing(p1.lat, p1.lng, p2.lat, p2.lng)
  }, [points, currentIndex])

  // Timer perulangan untuk animasi gerakan penanda
  useEffect(() => {
    if (isPlaying && points.length > 0) {
      const run = () => {
        setCurrentIndex((prev) => {
          if (prev >= points.length - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }
      
      // Mengurangi interval delay berdasarkan multiplier
      const intervalDelay = Math.max(15, 180 / speedMultiplier)
      timerRef.current = setInterval(run, intervalDelay)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, speedMultiplier, points])

  if (!points || points.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-muted text-muted-foreground text-sm rounded-xl">
        Tidak ada data koordinat rute untuk peta
      </div>
    )
  }

  // Format timestamp UTC/ISO ke WIB lokal
  const formatWibTime = (isoString: string) => {
    if (!isoString) return ""
    const date = new Date(isoString)
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + " WIB"
  }

  return (
    <div className={cn(
      "relative w-full flex flex-col overflow-hidden",
      isFullScreen 
        ? "fixed inset-0 z-[9999] bg-background h-screen w-screen" 
        : "h-full w-full z-0"
    )}>
      {/* Bagian Atas: Leaflet Map */}
      <div className="relative flex-1 bg-muted min-h-0 w-full">
        <MapContainer
          key={mapKey}
          center={[points[0].lat, points[0].lng]}
          zoom={14}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          <FitRouteBounds points={points} />
          <InvalidateMapSize trigger={isFullScreen} />
          
          {currentPoint && (
            <>
              <FollowMarker lat={currentPoint.lat} lng={currentPoint.lng} active={autoFollow} />
              <Marker position={[currentPoint.lat, currentPoint.lng]} icon={createCarIcon(bearing)} />
            </>
          )}

          {/* Gambar Garis Rute (Polyline) */}
          <Polyline positions={pathPositions} color="#3b82f6" weight={4} opacity={0.7} />
          
          {/* Penanda Awal (Start - Hijau) */}
          <Marker 
            position={[points[0].lat, points[0].lng]} 
            icon={L.divIcon({
              html: `<div class="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-md"></div>`,
              className: "start-marker-icon",
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            })} 
          />
          
          {/* Penanda Akhir (End - Merah) */}
          <Marker 
            position={[points[points.length - 1].lat, points[points.length - 1].lng]} 
            icon={L.divIcon({
              html: `<div class="w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white shadow-md"></div>`,
              className: "end-marker-icon",
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            })} 
          />
        </MapContainer>

        {/* Overlay Informasi HUD Kendaraan */}
        {currentPoint && (
          <div className="absolute top-3 left-3 right-3 z-[1000] flex gap-2 justify-between pointer-events-none">
            <div className="flex items-center gap-1.5 bg-background/90 dark:bg-card/95 backdrop-blur-sm border border-border px-3 py-1.5 rounded-full shadow-md select-none pointer-events-auto">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground">
                {formatWibTime(currentPoint.timestamp)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-background/90 dark:bg-card/95 backdrop-blur-sm border border-border px-3 py-1.5 rounded-full shadow-md select-none pointer-events-auto">
              <Gauge className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-bold text-foreground">
                {Math.round(currentPoint.speed)} km/h
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bagian Bawah: Kontrol Pemutaran */}
      <div className={cn(
        isFullScreen 
          ? "absolute bottom-6 left-4 right-4 z-[1000] bg-background/95 dark:bg-card/95 backdrop-blur-md border border-border p-4 rounded-2xl shadow-xl space-y-3" 
          : "p-4 bg-card border-t border-border space-y-4"
      )}>
        {/* Slider Timeline */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-muted-foreground select-none">Mulai</span>
          <input
            type="range"
            min="0"
            max={points.length - 1}
            value={currentIndex}
            onChange={(e) => {
              setCurrentIndex(parseInt(e.target.value))
              setIsPlaying(false) // pause saat diseret/scrub
            }}
            className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-muted accent-primary focus:outline-none"
          />
          <span className="text-[10px] font-semibold text-muted-foreground select-none">Selesai</span>
        </div>

        {/* Tombol Kontrol */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Tombol Play/Pause */}
            <Button
              size="icon"
              variant="default"
              className="h-9 w-9 rounded-xl shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                if (currentIndex >= points.length - 1) {
                  setCurrentIndex(0) // restart dari awal
                }
                setIsPlaying(!isPlaying)
              }}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-primary-foreground stroke-none" />
              ) : (
                <Play className="h-4 w-4 fill-primary-foreground stroke-none translate-x-[1px]" />
              )}
            </Button>

            {/* Tombol Restart / Reset */}
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 rounded-xl border-border bg-background hover:bg-secondary text-foreground"
              onClick={() => {
                setCurrentIndex(0)
                setIsPlaying(false)
              }}
              title="Reset ke awal"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>

            {/* Tombol Auto-Follow Kamera */}
            <Button
              size="icon"
              variant={autoFollow ? "secondary" : "outline"}
              className={`h-9 w-9 rounded-xl border shadow-sm ${
                autoFollow 
                  ? "bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary" 
                  : "bg-background border-border text-muted-foreground hover:bg-secondary"
              }`}
              onClick={() => setAutoFollow(!autoFollow)}
              title="Auto-Follow Kamera"
            >
              {autoFollow ? <Eye className="h-4.5 w-4.5" /> : <EyeOff className="h-4.5 w-4.5" />}
            </Button>

            {/* Tombol Layar Penuh (Fullscreen Toggle) */}
            <Button
              size="icon"
              variant={isFullScreen ? "secondary" : "outline"}
              className={`h-9 w-9 rounded-xl border shadow-sm ${
                isFullScreen 
                  ? "bg-primary/10 border-primary/20 text-primary" 
                  : "bg-background border-border text-muted-foreground hover:bg-secondary"
              }`}
              onClick={() => setIsFullScreen(!isFullScreen)}
              title={isFullScreen ? "Perkecil Layar" : "Layar Penuh"}
            >
              {isFullScreen ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
            </Button>
          </div>

          {/* Pemilih Kecepatan (1x, 2x, 4x, 8x) */}
          <div className="flex items-center bg-muted p-0.5 rounded-xl border border-border/30">
            {([1, 2, 4, 8] as const).map((spd) => (
              <button
                key={spd}
                onClick={() => setSpeedMultiplier(spd)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  speedMultiplier === spd
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
