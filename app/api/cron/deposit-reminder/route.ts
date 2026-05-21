import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import * as admin from "firebase-admin"

export const maxDuration = 60

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}")
  if (serviceAccount.project_id) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }
}

const GLONASS_BASE = "https://hosting.glonasssoft.ru"
const GLONASS_USER = "grahatakanusantara"
const GLONASS_PASS = "gtn1234567"

async function glonassLogin(): Promise<string | null> {
  try {
    const resp = await fetch(`${GLONASS_BASE}/api/v3/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: GLONASS_USER, password: GLONASS_PASS }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return data.AuthId || data.SessionId || data.token || null
  } catch {
    return null
  }
}

async function getVehicles(token: string) {
  try {
    const resp = await fetch(`${GLONASS_BASE}/api/vehicles?AuthId=${token}`, {
      headers: { "X-Auth": token, AuthId: token, Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return []
    return await resp.json()
  } catch {
    return []
  }
}

async function vehicleHadTripsToday(token: string, vehicleId: number): Promise<{ hadTrips: boolean; destination?: string }> {
  const now = new Date()
  const wibOffset = 7 * 60 * 60 * 1000
  const wibNow = new Date(now.getTime() + wibOffset)
  const todayStr = wibNow.toISOString().split("T")[0]

  const dateFrom = new Date(`${todayStr}T00:00:00+07:00`)
  const dateTo = new Date(`${todayStr}T23:59:59+07:00`)

  const params = new URLSearchParams({
    vehicleId: String(vehicleId),
    start: dateFrom.toISOString(),
    end: dateTo.toISOString(),
  })

  try {
    const resp = await fetch(`${GLONASS_BASE}/api/history/points?${params}`, {
      headers: { "X-Auth": token, AuthId: token, Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return { hadTrips: false }
    const text = await resp.text()
    if (!text || !text.includes("&")) return { hadTrips: false }

    const clean = text.replace(/^"|"$/g, "")
    const ampIdx = clean.indexOf("&")
    if (ampIdx === -1) return { hadTrips: false }
    const dataPart = clean.substring(ampIdx + 1)
    const segments = dataPart.split(":")

    // Parse all points
    interface Point { lat: number; lng: number; speed: number }
    const points: Point[] = []
    let movingPoints = 0

    for (const s of segments) {
      if (!s) continue
      const parts = s.split(",")
      if (parts.length < 3) continue
      const lat = parseFloat(parts[0])
      const lng = parseFloat(parts[1])
      const speed = parts.length > 3 ? parseFloat(parts[3]) : 0
      if (lat === 0 && lng === 0) continue
      if (speed > 3) movingPoints++
      points.push({ lat, lng, speed })
    }

    if (movingPoints <= 10 || points.length < 5) return { hadTrips: false }

    // Find the "unloading point" = start of the last trip heading back home
    const startLat = points[0].lat
    const startLng = points[0].lng
    const HOME_RADIUS_KM = 8

    // Strategy: find the last point where vehicle was far from home,
    // right before it starts heading back (the next points get closer to home)
    // This is the "departure from destination" = unloading location
    let destinationLat = 0
    let destinationLng = 0

    // Walk backwards: find where vehicle entered home area
    let homeEntryIndex = -1
    for (let i = points.length - 1; i >= 0; i--) {
      const dist = haversine(startLat, startLng, points[i].lat, points[i].lng)
      if (dist > HOME_RADIUS_KM) {
        homeEntryIndex = i
        break
      }
    }

    // The point at homeEntryIndex is the last point far from home
    // But we want the stop BEFORE the return trip started
    // So scan backwards from homeEntryIndex to find where speed was 0 (stopped)
    if (homeEntryIndex > 0) {
      // Find the stop point around homeEntryIndex (where vehicle was stopped before heading home)
      for (let i = homeEntryIndex; i >= Math.max(0, homeEntryIndex - 50); i--) {
        if (points[i].speed === 0) {
          const dist = haversine(startLat, startLng, points[i].lat, points[i].lng)
          if (dist > HOME_RADIUS_KM) {
            destinationLat = points[i].lat
            destinationLng = points[i].lng
            break
          }
        }
      }
      // Fallback: just use the homeEntryIndex point itself
      if (destinationLat === 0) {
        destinationLat = points[homeEntryIndex].lat
        destinationLng = points[homeEntryIndex].lng
      }
    }

    // Geocode destination
    let destination = ""
    if (destinationLat !== 0 && destinationLng !== 0) {
      destination = await getCityName(destinationLat, destinationLng)
    }

    return { hadTrips: true, destination }
  } catch {
    return { hadTrips: false }
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function getCityName(lat: number, lng: number): Promise<string> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      { headers: { "User-Agent": "OkeMitraApp/1.0" } }
    )
    if (!resp.ok) return ""
    const data = await resp.json()
    const addr = data.address || {}
    return addr.city || addr.town || addr.municipality || addr.county || addr.state || ""
  } catch {
    return ""
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")
  if (key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const wibOffset = 7 * 60 * 60 * 1000
    const wibNow = new Date(now.getTime() + wibOffset)
    const today = wibNow.toISOString().split("T")[0]

    const [tokenRows] = await pool.execute(
      "SELECT driver_name, token FROM fcm_tokens WHERE token IS NOT NULL AND token != ''"
    ) as any

    if (!tokenRows || tokenRows.length === 0) {
      return NextResponse.json({ message: "No drivers with FCM tokens", sent: 0 })
    }

    const [depositRows] = await pool.execute(
      "SELECT DISTINCT driver FROM schedules WHERE date = ?",
      [today]
    ) as any

    const driversWithDeposit = new Set(
      (depositRows || []).map((r: any) => String(r.driver).trim().toLowerCase())
    )

    const glonassToken = await glonassLogin()
    if (!glonassToken) {
      return NextResponse.json({ error: "GlonassSoft login failed" }, { status: 500 })
    }

    const vehicles = await getVehicles(glonassToken)

    // Get driver-vehicle mapping from database
    const [driverVehicles] = await pool.execute(
      "SELECT name, vehicle FROM drivers WHERE vehicle IS NOT NULL AND vehicle != ''"
    ) as any

    const notifications: { driver: string; token: string; destination?: string }[] = []

    for (const row of tokenRows) {
      const driverName = String(row.driver_name).trim()

      if (driversWithDeposit.has(driverName.toLowerCase())) continue

      // Find vehicle plate from drivers table
      const driverRecord = (driverVehicles || []).find(
        (d: any) => String(d.name).trim().toLowerCase() === driverName.toLowerCase()
      )

      if (!driverRecord || !driverRecord.vehicle) continue

      const plate = String(driverRecord.vehicle).trim().toLowerCase()

      // Match plate with GlonassSoft vehicle
      const vehicle = vehicles.find((v: any) => {
        const vName = (v.number || v.Name || v.name || "").toLowerCase().replace(/\s+/g, "")
        const plateClean = plate.replace(/\s+/g, "")
        return vName.includes(plateClean) || plateClean.includes(vName)
      })

      if (vehicle && vehicle.vehicleId) {
        const result = await vehicleHadTripsToday(glonassToken, vehicle.vehicleId)
        if (result.hadTrips) {
          notifications.push({ driver: driverName, token: row.token, destination: result.destination })
        }
        await new Promise(r => setTimeout(r, 600))
      }
    }

    let sentCount = 0
    if (admin.apps.length > 0 && notifications.length > 0) {
      for (const notif of notifications) {
        const bodyText = notif.destination
          ? `Halo ${notif.driver}, hari ini narik ke ${notif.destination} ya? Segera lakukan setoran yaah 🙏`
          : `Halo ${notif.driver}, hari ini Anda narik? Segera lakukan setoran ya!`

        try {
          await admin.messaging().send({
            token: notif.token,
            notification: {
              title: "🚛 Reminder Setoran",
              body: bodyText,
            },
            data: { type: "deposit_reminder", url: "/deposit?tab=setoran" },
            android: {
              priority: "high",
              notification: { sound: "default", channelId: "deposit_reminder" },
            },
          })
          sentCount++
        } catch (err) {
          console.error(`Failed to send to ${notif.driver}:`, err)
        }
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      driversChecked: tokenRows.length,
      driversWithDeposit: driversWithDeposit.size,
      notificationsSent: sentCount,
      details: notifications.map(n => n.driver),
    })
  } catch (error) {
    console.error("Deposit reminder cron error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
