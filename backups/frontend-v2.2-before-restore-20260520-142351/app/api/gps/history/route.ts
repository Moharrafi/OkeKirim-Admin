import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 30

const BASE_URL = "https://hosting.glonasssoft.ru"
const USERNAME = "grahatakanusantara"
const PASSWORD = "gtn1234567"

async function login(): Promise<string | null> {
  try {
    const resp = await fetch(`${BASE_URL}/api/v3/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: USERNAME, password: PASSWORD }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return data.AuthId || data.SessionId || data.token || null
  } catch {
    return null
  }
}

async function getVehicles(token: string) {
  const headers: Record<string, string> = {
    "X-Auth": token,
    AuthId: token,
    Authorization: `Bearer ${token}`,
  }
  try {
    const resp = await fetch(`${BASE_URL}/api/vehicles?AuthId=${token}`, { headers })
    if (!resp.ok) return []
    return await resp.json()
  } catch {
    return []
  }
}

async function getAddress(lat: number, lng: number): Promise<string> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "DriverDepositApp/1.0" } }
    )
    if (!resp.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    const data = await resp.json()
    const addr = data.address || {}
    const road = addr.road || addr.suburb || addr.city_district || addr.village || ""
    const area = addr.city || addr.town || addr.municipality || addr.county || ""
    if (road && area) return `${road}, ${area}`
    if (road) return road
    if (area) return area
    const display = data.display_name || ""
    if (display) return display.split(",").slice(0, 3).join(",").trim()
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface NavPoint {
  lat: number
  lng: number
  speed: number
  timestamp: string
}

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

function parseNavPoints(text: string): NavPoint[] {
  const clean = text.replace(/^"|"$/g, "")
  const ampIdx = clean.indexOf("&")
  if (ampIdx === -1) return []

  const basePart = clean.substring(0, ampIdx).replace("Z", "").trim()
  const dataPart = clean.substring(ampIdx + 1)
  if (!dataPart) return []

  const baseDate = new Date(basePart + "Z")
  const segments = dataPart.split(":")
  const points: NavPoint[] = []

  for (const s of segments) {
    if (!s) continue
    const parts = s.split(",")
    if (parts.length < 3) continue

    const lat = parseFloat(parts[0])
    const lng = parseFloat(parts[1])
    const offsetSec = parseFloat(parts[2])
    const speed = parts.length > 3 ? parseFloat(parts[3]) : 0

    const actualTime = new Date(baseDate.getTime() + offsetSec * 1000)
    points.push({ lat, lng, speed, timestamp: actualTime.toISOString() })
  }

  return points
}

function buildTrips(points: NavPoint[], stopThresholdKmh = 3, stopDurationMin = 5): Trip[] {
  if (points.length < 2) return []

  const trips: Trip[] = []
  let currentTripPoints: NavPoint[] = []
  let stoppedSince: Date | null = null

  for (const pt of points) {
    const ts = new Date(pt.timestamp)
    const isMoving = pt.speed > stopThresholdKmh

    if (isMoving) {
      stoppedSince = null
      currentTripPoints.push(pt)
    } else {
      if (stoppedSince === null) {
        stoppedSince = ts
        currentTripPoints.push(pt)
      } else {
        const stopDur = (ts.getTime() - stoppedSince.getTime()) / 60000
        if (stopDur >= stopDurationMin && currentTripPoints.length >= 2) {
          const trip = buildSingleTrip(currentTripPoints)
          if (trip) trips.push(trip)
          currentTripPoints = []
          stoppedSince = null
        } else {
          currentTripPoints.push(pt)
        }
      }
    }
  }

  if (currentTripPoints.length >= 2) {
    const trip = buildSingleTrip(currentTripPoints)
    if (trip) trips.push(trip)
  }

  // Only filter out truly micro-trips (< 0.2 km and start/end same spot)
  return trips.filter(t => {
    const startEndDist = haversine(t.startLat, t.startLng, t.endLat, t.endLng)
    // Keep if distance > 0.2 km OR start/end are different locations (> 100m apart)
    return t.distance >= 0.2 || startEndDist >= 0.1
  })
}

function buildSingleTrip(points: NavPoint[]): Trip | null {
  if (points.length < 2) return null

  const start = points[0]
  const end = points[points.length - 1]
  const speeds = points.filter((p) => p.speed > 0).map((p) => p.speed)

  const tStart = new Date(start.timestamp)
  const tEnd = new Date(end.timestamp)
  const duration = Math.round((tEnd.getTime() - tStart.getTime()) / 60000)

  if (duration < 1) return null

  let distance = 0
  for (let i = 0; i < points.length - 1; i++) {
    distance += haversine(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng)
  }

  const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0
  const avgSpeed = duration > 0 ? Math.round((distance / (duration / 60)) * 10) / 10 : 0

  return {
    startTime: start.timestamp,
    endTime: end.timestamp,
    startAddress: "",
    endAddress: "",
    startLat: start.lat,
    startLng: start.lng,
    endLat: end.lat,
    endLng: end.lng,
    distance: Math.round(distance * 100) / 100,
    duration,
    maxSpeed: Math.round(maxSpeed),
    avgSpeed,
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const vehicleId = searchParams.get("vehicleId")
  const date = searchParams.get("date") // format: YYYY-MM-DD

  if (!vehicleId) {
    return NextResponse.json({ error: "vehicleId diperlukan" }, { status: 400 })
  }

  const token = await login()
  if (!token) {
    return NextResponse.json({ error: "Login gagal" }, { status: 401 })
  }

  try {
    // Find the numeric vehicleId
    const vehicles = await getVehicles(token)
    const vehicle = vehicles.find(
      (v: { id?: string; vehicleId?: number }) =>
        v.id === vehicleId || String(v.vehicleId) === vehicleId
    )

    if (!vehicle) {
      return NextResponse.json({ error: "Kendaraan tidak ditemukan" }, { status: 404 })
    }

    const numId = vehicle.vehicleId
    const name = vehicle.number || vehicle.Name || vehicle.name || "Unknown"

    // Determine date range (use WIB = UTC+7)
    let dateFrom: Date
    let dateTo: Date

    if (date) {
      // Convert local date to UTC range
      // e.g. 2026-05-12 WIB = 2026-05-11T17:00:00Z to 2026-05-12T16:59:59Z
      dateFrom = new Date(`${date}T00:00:00+07:00`)
      dateTo = new Date(`${date}T23:59:59+07:00`)
    } else {
      // Today in WIB
      const now = new Date()
      const wibOffset = 7 * 60 * 60 * 1000
      const wibNow = new Date(now.getTime() + wibOffset)
      const todayStr = wibNow.toISOString().split("T")[0]
      dateFrom = new Date(`${todayStr}T00:00:00+07:00`)
      dateTo = now
    }

    // Rate limit delay
    await new Promise((r) => setTimeout(r, 500))

    // Get history points
    const headers: Record<string, string> = {
      "X-Auth": token,
      AuthId: token,
      Authorization: `Bearer ${token}`,
    }

    const params = new URLSearchParams({
      vehicleId: String(numId),
      start: dateFrom.toISOString(),
      end: dateTo.toISOString(),
    })

    const resp = await fetch(`${BASE_URL}/api/history/points?${params.toString()}`, { headers })

    if (!resp.ok) {
      return NextResponse.json({
        vehicle: name,
        date: date || new Date().toISOString().split("T")[0],
        trips: [],
        message: "Tidak ada data perjalanan",
      })
    }

    const text = await resp.text()
    if (!text || !text.includes("&")) {
      return NextResponse.json({
        vehicle: name,
        date: date || new Date().toISOString().split("T")[0],
        trips: [],
        message: "Tidak ada data perjalanan untuk tanggal ini",
      })
    }

    const navPoints = parseNavPoints(text)
    const trips = buildTrips(navPoints)

    // If no trips but we have nav points, show the parked location
    let parkedLocation: { address: string; lat: number; lng: number; since: string; until: string } | null = null

    if (trips.length === 0 && navPoints.length > 0) {
      // Vehicle stayed in one place - get that location (only 1 geocode call)
      const firstPoint = navPoints[0]
      const lastPoint = navPoints[navPoints.length - 1]
      const address = await getAddress(firstPoint.lat, firstPoint.lng)
      parkedLocation = {
        address,
        lat: firstPoint.lat,
        lng: firstPoint.lng,
        since: firstPoint.timestamp,
        until: lastPoint.timestamp,
      }
    }

    // Don't geocode here - let the client do it via /api/geocode
    // This makes the response much faster

    // Calculate totals
    const totalDistance = trips.reduce((sum, t) => sum + t.distance, 0)
    const totalDuration = trips.reduce((sum, t) => sum + t.duration, 0)

    return NextResponse.json({
      vehicle: name,
      date: date || new Date().toISOString().split("T")[0],
      trips,
      parkedLocation,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalDuration,
      totalPoints: navPoints.length,
    })
  } catch (error) {
    return NextResponse.json({ error: `Error: ${error}` }, { status: 500 })
  }
}
