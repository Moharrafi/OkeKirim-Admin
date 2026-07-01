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

function createIcon(color: string, plate: string) {
  const html = `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; width: 120px; height: 70px;">
      <!-- Label Nopol di atas penunjuk marker -->
      <div style="
        background-color: white; 
        color: #1e293b; 
        font-weight: bold; 
        font-family: monospace;
        font-size: 10px; 
        padding: 1px 5px; 
        border-radius: 4px; 
        border: 1px solid #cbd5e1;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        white-space: nowrap;
        margin-bottom: 2px;
        line-height: 1.2;
      ">
        ${plate}
      </div>
      
      <!-- Penunjuk Marker SVG -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="32" height="48" style="display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="8" fill="#fff"/>
        <g transform="translate(5, 5) scale(0.583)" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="1.5" fill="${color}" />
          <path d="M9 17h6" />
          <circle cx="17" cy="17" r="1.5" fill="${color}" />
        </g>
      </svg>
    </div>
  `
  return L.divIcon({
    html: html,
    className: "custom-div-icon",
    iconSize: [120, 70],
    iconAnchor: [60, 70],
    popupAnchor: [0, -70],
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
  const [mapKey, setMapKey] = useState("vehicle-map-init")

  useEffect(() => {
    setMapKey("vehicle-map-mounted")
  }, [])

  return (
    <MapContainer
      key={mapKey}
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
          icon={createIcon(getMarkerColor(vehicle.status), vehicle.plate)}
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
