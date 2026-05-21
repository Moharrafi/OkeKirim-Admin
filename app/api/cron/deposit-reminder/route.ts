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

async function getDestination(vehicleId: string, date: string): Promise<string> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://oke-kirim.vercel.app"

    const resp = await fetch(`${baseUrl}/api/gps/history?vehicleId=${vehicleId}&date=${date}`)
    if (!resp.ok) return ""
    const data = await resp.json()

    if (!data.trips || data.trips.length === 0) return ""

    const trips = data.trips
    const homeLat = trips[0].startLat
    const homeLng = trips[0].startLng
    const HOME_RADIUS_KM = 5

    // Case 1: Find last trip that ends near home → use its start (unloading point)
    for (let i = trips.length - 1; i >= 0; i--) {
      const endDist = haversine(homeLat, homeLng, trips[i].endLat, trips[i].endLng)
      const startDist = haversine(homeLat, homeLng, trips[i].startLat, trips[i].startLng)
      if (endDist <= HOME_RADIUS_KM && startDist > HOME_RADIUS_KM) {
        return await getCityName(trips[i].startLat, trips[i].startLng)
      }
    }

    // Case 2: Vehicle hasn't returned home → use end of last trip
    const lastTrip = trips[trips.length - 1]
    const lastEndDist = haversine(homeLat, homeLng, lastTrip.endLat, lastTrip.endLng)
    if (lastEndDist > HOME_RADIUS_KM) {
      return await getCityName(lastTrip.endLat, lastTrip.endLng)
    }

    // Case 3: Use the farthest trip endpoint
    let maxDist = 0
    let farthestLat = 0
    let farthestLng = 0
    for (const t of trips) {
      const d = haversine(homeLat, homeLng, t.endLat, t.endLng)
      if (d > maxDist) {
        maxDist = d
        farthestLat = t.endLat
        farthestLng = t.endLng
      }
    }
    if (maxDist > 3) {
      return await getCityName(farthestLat, farthestLng)
    }

    return ""
  } catch {
    return ""
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
    const today = searchParams.get("date") || wibNow.toISOString().split("T")[0]

    // 1. Get all drivers with FCM tokens
    const [tokenRows] = await pool.execute(
      "SELECT driver_name, token FROM fcm_tokens WHERE token IS NOT NULL AND token != ''"
    ) as any

    if (!tokenRows || tokenRows.length === 0) {
      return NextResponse.json({ message: "No drivers with FCM tokens", sent: 0 })
    }

    // 2. Get drivers who already deposited today
    const [depositRows] = await pool.execute(
      "SELECT DISTINCT driver FROM schedules WHERE date = ?",
      [today]
    ) as any

    const driversWithDeposit = new Set(
      (depositRows || []).map((r: any) => String(r.driver).trim().toLowerCase())
    )

    // 3. Get vehicles from GlonassSoft
    const glonassToken = await glonassLogin()
    const vehicles = glonassToken ? await getVehicles(glonassToken) : []

    // 4. Get driver-vehicle mapping
    const [driverVehicles] = await pool.execute(
      "SELECT name, vehicle FROM drivers WHERE vehicle IS NOT NULL AND vehicle != ''"
    ) as any

    // 5. Build notifications for all drivers who haven't deposited
    const notifications: { driver: string; token: string; destination: string }[] = []

    for (const row of tokenRows) {
      const driverName = String(row.driver_name).trim()

      // Skip if already deposited
      if (driversWithDeposit.has(driverName.toLowerCase())) continue

      // Try to get destination (best effort)
      let destination = ""
      try {
        const driverRecord = (driverVehicles || []).find(
          (d: any) => String(d.name).trim().toLowerCase() === driverName.toLowerCase()
        )
        if (driverRecord && driverRecord.vehicle) {
          const plate = String(driverRecord.vehicle).trim().toLowerCase().replace(/\s+/g, "")
          const vehicle = vehicles.find((v: any) => {
            const vName = (v.number || v.Name || v.name || "").toLowerCase().replace(/\s+/g, "")
            return vName.includes(plate) || plate.includes(vName)
          })
          if (vehicle && vehicle.id) {
            destination = await getDestination(vehicle.id, today)
          }
        }
      } catch { /* GPS failed - still send notif */ }

      notifications.push({ driver: driverName, token: row.token, destination })
    }

    // 6. Send push notifications
    let sentCount = 0
    if (admin.apps.length > 0 && notifications.length > 0) {
      for (const notif of notifications) {
        const bodyText = notif.destination
          ? `Halo ${notif.driver}, hari ini narik ke ${notif.destination} ya? Segera lakukan setoran yaah 🙏`
          : `Halo ${notif.driver}, sudah narik hari ini? Segera lakukan setoran ya! 🙏`

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
      details: notifications.map(n => ({ driver: n.driver, destination: n.destination || "(no GPS)" })),
    })
  } catch (error) {
    console.error("Deposit reminder cron error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
