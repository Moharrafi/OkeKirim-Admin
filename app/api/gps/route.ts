import { NextRequest, NextResponse } from "next/server"

// Increase Vercel serverless function timeout to 30 seconds
export const maxDuration = 30

const BASE_URL = "https://hosting.glonasssoft.ru"
const USERNAME = process.env.GLONASS_USERNAME || ""
const PASSWORD = process.env.GLONASS_PASSWORD || ""

interface GlonassVehicle {
  id?: string
  Id?: string
  vehicleId?: number
  name?: string
  Name?: string
  number?: string
  StateNumber?: string
  GarageNumber?: string
}

async function login(): Promise<string | null> {
  if (!USERNAME || !PASSWORD) return null

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

async function getVehicles(token: string): Promise<GlonassVehicle[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Auth": token,
    AuthId: token,
    Authorization: `Bearer ${token}`,
  }

  try {
    const resp = await fetch(`${BASE_URL}/api/vehicles?AuthId=${token}`, {
      headers,
    })
    if (!resp.ok) return []
    const data = await resp.json()
    if (Array.isArray(data)) return data
    return []
  } catch {
    return []
  }
}

async function getLastPosition(
  token: string,
  vehicleId: number
): Promise<{ lat: number; lng: number; speed: number; timestamp: string } | null> {
  return getHistoryPosition(token, vehicleId, 2)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getHistoryPosition(
  token: string,
  vehicleId: number,
  daysBack: number
): Promise<{ lat: number; lng: number; speed: number; timestamp: string } | null> {
  const headers: Record<string, string> = {
    "X-Auth": token,
    AuthId: token,
    Authorization: `Bearer ${token}`,
  }

  const now = new Date()
  const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    vehicleId: String(vehicleId),
    start: from.toISOString(),
    end: now.toISOString(),
  })

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(
        `${BASE_URL}/api/history/points?${params.toString()}`,
        { headers }
      )

      if (resp.ok) {
        const text = await resp.text()
        if (text && text.includes("&")) {
          const position = parsePositionFromText(text)
          if (position && position.lat !== 0 && position.lng !== 0) {
            return position
          }
        }
      }
    } catch {
      // Retry below. GlonassSoft history calls can fail intermittently under load.
    }

    await sleep(250 * (attempt + 1))
  }

  return null
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  )

  return results
}

function normalizeVehicle(v: GlonassVehicle, pos: { lat: number; lng: number; speed: number; timestamp: string } | null) {
  const numId = v.vehicleId
  const name = v.number || v.Name || v.name || "Unknown"
  const plate = v.number || v.StateNumber || v.GarageNumber || ""
  const vid = v.id || v.Id || String(numId)

  if (!numId || !pos || pos.lat === 0 || pos.lng === 0) {
    return {
      id: vid, name, plate,
      lat: 0, lng: 0, speed: 0, course: 0,
      lastUpdate: "", status: "offline",
      address: "Tidak ada sinyal GPS",
    }
  }

  let status = "active"
  if (pos.speed === 0) status = "idle"
  const diffMs = Date.now() - new Date(pos.timestamp).getTime()
  if (diffMs > 5 * 60 * 1000) status = "offline"

  return {
    id: vid, name, plate,
    lat: pos.lat, lng: pos.lng,
    speed: Math.round(pos.speed), course: 0,
    lastUpdate: pos.timestamp, status,
    address: "",
  }
}

async function getLastPositionExtended(
  token: string,
  vehicleId: number
): Promise<{ lat: number; lng: number; speed: number; timestamp: string } | null> {
  return getHistoryPosition(token, vehicleId, 7)
}

function parsePositionFromText(text: string): { lat: number; lng: number; speed: number; timestamp: string } | null {
  try {
    // Parse format: "2026-05-13 14:14:20Z&lat,lng,offsetSec,speed:lat,lng,offsetSec,speed..."
    const cleanText = text.replace(/^"|"$/g, "")
    const ampIdx = cleanText.indexOf("&")
    if (ampIdx === -1) return null
    const basePart = cleanText.substring(0, ampIdx)
    const dataPart = cleanText.substring(ampIdx + 1)
    if (!dataPart) return null

    const segments = dataPart.split(":")
    const lastSegment = segments[segments.length - 1]
    if (!lastSegment) return null

    const parts = lastSegment.split(",")
    if (parts.length < 3) return null

    const lat = parseFloat(parts[0])
    const lng = parseFloat(parts[1])
    const offsetSec = parseFloat(parts[2])
    const speed = parts.length > 3 ? parseFloat(parts[3]) : 0

    const baseTime = basePart.replace("Z", "").trim()
    const baseDate = new Date(baseTime + "Z")
    const actualTime = new Date(baseDate.getTime() + offsetSec * 1000)

    return { lat, lng, speed, timestamp: actualTime.toISOString() }
  } catch {
    return null
  }
}

async function logout(token: string) {
  try {
    await fetch(`${BASE_URL}/api/v3/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth": token,
        AuthId: token,
      },
    })
  } catch {
    // ignore
  }
}

async function getAddress(lat: number, lng: number): Promise<string> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: { "User-Agent": "DriverDepositApp/1.0" },
      }
    )
    if (!resp.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    const data = await resp.json()
    const addr = data.address || {}
    const road = addr.road || addr.suburb || addr.city_district || addr.village || ""
    const area = addr.city || addr.town || addr.municipality || addr.county || ""
    if (road && area) return `${road}, ${area}`
    if (road) return road
    if (area) return area
    // Fallback: use display_name truncated
    const display = data.display_name || ""
    if (display) return display.split(",").slice(0, 3).join(",").trim()
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}

// Simple in-memory cache.
let gpsCache: { data: unknown; timestamp: number } | null = null
let gpsRefreshPromise: Promise<unknown> | null = null
const GPS_CACHE_TTL = 30000
const GPS_STALE_TTL = 5 * 60000

async function buildGpsResponse() {
  const token = await login()
  if (!token) {
    throw new Error("Login ke GlonassSoft gagal")
  }

  try {
    const vehicles = await getVehicles(token)
    if (vehicles.length === 0) {
      return {
        vehicles: [],
        message: "Tidak ada kendaraan ditemukan",
      }
    }

    const results = await mapWithConcurrency(vehicles, 1, async (v) => {
      const numId = v.vehicleId
      if (!numId) return normalizeVehicle(v, null)

      let pos = await getLastPosition(token, numId)

      if (!pos || (pos.lat === 0 && pos.lng === 0)) {
        pos = await getLastPositionExtended(token, numId)
      }

      return normalizeVehicle(v, pos)
    })

    return {
      vehicles: results,
      count: results.length,
      timestamp: new Date().toISOString(),
    }
  } finally {
    await logout(token)
  }
}

function refreshGpsCache() {
  if (!gpsRefreshPromise) {
    gpsRefreshPromise = buildGpsResponse()
      .then((data) => {
        gpsCache = { data, timestamp: Date.now() }
        return data
      })
      .finally(() => {
        gpsRefreshPromise = null
      })
  }

  return gpsRefreshPromise
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get("refresh") === "1"
  const now = Date.now()

  if (!forceRefresh && gpsCache && now - gpsCache.timestamp < GPS_CACHE_TTL) {
    return NextResponse.json(gpsCache.data)
  }

  if (!forceRefresh && gpsCache && now - gpsCache.timestamp < GPS_STALE_TTL) {
    refreshGpsCache().catch(() => {})
    return NextResponse.json({ ...(gpsCache.data as Record<string, unknown>), stale: true })
  }

  try {
    const data = await refreshGpsCache()
    return NextResponse.json(data)
  } catch (error) {
    if (gpsCache) {
      return NextResponse.json({ ...(gpsCache.data as Record<string, unknown>), stale: true })
    }

    return NextResponse.json(
      { error: `Error: ${error}` },
      { status: 500 }
    )
  }
}
