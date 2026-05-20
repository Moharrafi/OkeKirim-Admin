"use client"

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { useEffect, useState } from "react"

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

interface VehicleMapProps {
  vehicles: Vehicle[]
  selectedVehicle: string | null
  onMarkerClick: (id: string) => void
  expanded?: boolean
  fitAll?: boolean
  onFitComplete?: () => void
}

function createIcon(color: string) {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="32" height="48">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="6" fill="#fff"/>
      <path d="M9 12l1.5-3h3L15 12l-1.5 3h-3L9 12z" fill="${color}"/>
    </svg>
  `
  return L.divIcon({
    html: svgIcon,
    className: "",
    iconSize: [32, 48],
    iconAnchor: [16, 48],
    popupAnchor: [0, -48],
  })
}

function getMarkerColor(status: string) {
  switch (status) {
    case "active":
      return "#10b981"
    case "idle":
      return "#f59e0b"
    case "offline":
      return "#94a3b8"
    default:
      return "#94a3b8"
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "Aktif"
    case "idle":
      return "Diam"
    case "offline":
      return "Offline"
    default:
      return "Unknown"
  }
}

function FlyToVehicle({ vehicle }: { vehicle: Vehicle | null }) {
  const map = useMap()
  useEffect(() => {
    if (vehicle && vehicle.lat !== 0 && vehicle.lng !== 0) {
      map.flyTo([vehicle.lat, vehicle.lng], 14, { duration: 0.8 })
    }
    // Don't do anything when vehicle becomes null (user closed detail)
  }, [vehicle, map])
  return null
}

function FitBounds({ vehicles }: { vehicles: Vehicle[] }) {
  const map = useMap()
  const [hasFitted, setHasFitted] = useState(false)

  useEffect(() => {
    if (hasFitted) return // Only fit once on initial load
    const validVehicles = vehicles.filter(v => v.lat !== 0 && v.lng !== 0)
    if (validVehicles.length === 0) return

    const bounds = L.latLngBounds(
      validVehicles.map(v => [v.lat, v.lng] as [number, number])
    )
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
    setHasFitted(true)
  }, [vehicles, map, hasFitted])
  return null
}

function InvalidateSize({ expanded }: { expanded?: boolean }) {
  const map = useMap()
  useEffect(() => {
    // Delay to let CSS transition finish, then tell Leaflet to recalculate size
    const timeout = setTimeout(() => {
      map.invalidateSize()
    }, 350)
    return () => clearTimeout(timeout)
  }, [expanded, map])
  return null
}

function FitAllVehicles({ vehicles, fitAll, onFitComplete }: { vehicles: Vehicle[]; fitAll?: boolean; onFitComplete?: () => void }) {
  const map = useMap()
  useEffect(() => {
    if (!fitAll) return
    const validVehicles = vehicles.filter(v => v.lat !== 0 && v.lng !== 0)
    if (validVehicles.length === 0) {
      onFitComplete?.()
      return
    }
    const bounds = L.latLngBounds(
      validVehicles.map(v => [v.lat, v.lng] as [number, number])
    )
    map.flyToBounds(bounds, { padding: [30, 30], maxZoom: 13, duration: 0.8 })
    onFitComplete?.()
  }, [fitAll, vehicles, map, onFitComplete])
  return null
}

export default function VehicleMap({ vehicles, selectedVehicle, onMarkerClick, expanded, fitAll, onFitComplete }: VehicleMapProps) {
  const selectedData = vehicles.find((v) => v.id === selectedVehicle) || null

  return (
    <MapContainer
      center={[-6.2088, 106.8256]}
      zoom={12}
      style={{ width: "100%", height: "100%" }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitBounds vehicles={vehicles} />
      <FitAllVehicles vehicles={vehicles} fitAll={fitAll} onFitComplete={onFitComplete} />
      <FlyToVehicle vehicle={selectedData} />
      <InvalidateSize expanded={expanded} />
      {vehicles.filter(v => v.lat !== 0 && v.lng !== 0).map((vehicle) => (
        <Marker
          key={vehicle.id}
          position={[vehicle.lat, vehicle.lng]}
          icon={createIcon(getMarkerColor(vehicle.status))}
          eventHandlers={{
            click: () => onMarkerClick(vehicle.id),
          }}
        >
          <Popup>
            <div className="min-w-[160px]">
              <p className="font-semibold text-sm">{vehicle.driver}</p>
              <p className="text-xs text-gray-500">{vehicle.plate}</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: getMarkerColor(vehicle.status) }}
                />
                <span className="text-xs">{getStatusLabel(vehicle.status)}</span>
                {vehicle.speed > 0 && (
                  <span className="text-xs text-gray-600">{vehicle.speed} km/h</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{vehicle.location}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
