import { NextResponse } from "next/server"

// Increase Vercel serverless function timeout to 30 seconds
export const maxDuration = 30

const BASE_URL = "https://hosting.glonasssoft.ru"
const USERNAME = "grahatakanusantara"
const PASSWORD = "gtn1234567"

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
  const headers: Record<string, string> = {
    "X-Auth": token,
    AuthId: token,
    Authorization: `Bearer ${token}`,
  }

  try {
    // Get points from last 48 hours to find latest position
    const now = new Date()
    const from = new Date(now.getTime() - 48 * 60 * 60 * 1000) // 48 hours ago

    const params = new URLSearchParams({
      vehicleId: String(vehicleId),
      start: from.toISOString(),
      end: now.toISOString(),
    })

    const resp = await fetch(
      `${BASE_URL}/api/history/points?${params.toString()}`,
      { headers }
    )

    if (!resp.ok) return null
    const text = await resp.text()
    if (!text || !text.includes("&")) return null

    return parsePositionFromText(text)
  } catch {
    return null
  }
}

async function getLastPositionExtended(
  token: string,
  vehicleId: number
): Promise<{ lat: number; lng: number; speed: number; timestamp: string } | null> {
  const headers: Record<string, string> = {
    "X-Auth": token,
    AuthId: token,
    Authorization: `Bearer ${token}`,
  }

  try {
    // Fallback: 7 days for parked vehicles
    const now = new Date()
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const params = new URLSearchParams({
      vehicleId: String(vehicleId),
      start: from.toISOString(),
      end: now.toISOString(),
    })

    const resp = await fetch(
      `${BASE_URL}/api/history/points?${params.toString()}`,
      { headers }
    )

    if (!resp.ok) return null
    const text = await resp.text()
    if (!text || !text.includes("&")) return null

    return parsePositionFromText(text)
  } catch {
    return null
  }
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

// Simple in-memory cache (60 seconds)
let gpsCache: { data: unknown; timestamp: number } | null = null
const GPS_CACHE_TTL = 60000 // 60 seconds

export async function GET() {
  // Return cached data if fresh
  if (gpsCache && Date.now() - gpsCache.timestamp < GPS_CACHE_TTL) {
    return NextResponse.json(gpsCache.data)
  }

  const token = await login()
  if (!token) {
    return NextResponse.json(
      { error: "Login ke GlonassSoft gagal" },
      { status: 401 }
    )
  }

  try {
    const vehicles = await getVehicles(token)
    if (vehicles.length === 0) {
      return NextResponse.json({
        vehicles: [],
        message: "Tidak ada kendaraan ditemukan",
      })
    }

    // Fetch positions sequentially with delay (GlonassSoft strict rate limit)
    const results = []
    for (const v of vehicles) {
      const numId = v.vehicleId
      const name = v.number || v.Name || v.name || "Unknown"
      const plate = v.number || v.StateNumber || v.GarageNumber || ""
      const vid = v.id || v.Id || String(numId)

      if (!numId) {
        results.push({
          id: vid, name, plate,
          lat: 0, lng: 0, speed: 0, course: 0,
          lastUpdate: "", status: "offline",
          address: "Tidak ada sinyal GPS",
        })
        continue
      }

      // Try 48 hours first
      let pos = await getLastPosition(token, numId)

      // Fallback: 7 days for parked vehicles
      if (!pos || (pos.lat === 0 && pos.lng === 0)) {
        await new Promise((r) => setTimeout(r, 600))
        pos = await getLastPositionExtended(token, numId)
      }

      if (pos && pos.lat !== 0 && pos.lng !== 0) {
        let status = "active"
        if (pos.speed === 0) status = "idle"
        const diffMs = Date.now() - new Date(pos.timestamp).getTime()
        if (diffMs > 5 * 60 * 1000) status = "offline"

        results.push({
          id: vid, name, plate,
          lat: pos.lat, lng: pos.lng,
          speed: Math.round(pos.speed), course: 0,
          lastUpdate: pos.timestamp, status,
          address: "",
        })
      } else {
        results.push({
          id: vid, name, plate,
          lat: 0, lng: 0, speed: 0, course: 0,
          lastUpdate: "", status: "offline",
          address: "Tidak ada sinyal GPS",
        })
      }

      // Rate limit delay
      await new Promise((r) => setTimeout(r, 600))
    }

    const responseData = {
      vehicles: results,
      count: results.length,
      timestamp: new Date().toISOString(),
    }

    // Cache the result
    gpsCache = { data: responseData, timestamp: Date.now() }

    return NextResponse.json(responseData)
  } catch (error) {
    return NextResponse.json(
      { error: `Error: ${error}` },
      { status: 500 }
    )
  } finally {
    await logout(token)
  }
}
