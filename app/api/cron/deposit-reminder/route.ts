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

async function vehicleHadTripsToday(token: string, vehicleId: string, dateOverride?: string): Promise<{ hadTrips: boolean; destination?: string }> {
  const todayStr = dateOverride || (() => {
    const now = new Date()
    const wibOffset = 7 * 60 * 60 * 1000
    const wibNow = new Date(now.getTime() + wibOffset)
    return wibNow.toISOString().split("T")[0]
  })()

  try {
    // Call our own GPS history API (same logic as the app's Detail Perjalanan page)
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_BASE_URL || "https://oke-kirim.vercel.app"
    
    const resp = await fetch(
      `${baseUrl}/api/gps/history?vehicleId=${vehicleId}&date=${todayStr}`,
      { headers: { "Cache-Control": "no-cache" } }
    )
    
    if (!resp.ok) return { hadTrips: false }
    const data = await resp.json()

    if (!data.trips || data.trips.length === 0) return { hadTrips: false }

    // Find destination: 
    const trips = data.trips
    const homeLat = trips[0].startLat
    const homeLng = trips[0].startLng
    const HOME_RADIUS_KM = 5

    let destinationLat = 0
    let destinationLng = 0

    // Case 1: Find last trip that ends near home (return trip) → use its start
    for (let i = trips.length - 1; i >= 0; i--) {
      const endDist = haversine(homeLat, homeLng, trips[i].endLat, trips[i].endLng)
      const startDist = haversine(homeLat, homeLng, trips[i].startLat, trips[i].startLng)
      if (endDist <= HOME_RADIUS_KM && startDist > HOME_RADIUS_KM) {
        destinationLat = trips[i].startLat
        destinationLng = trips[i].startLng
        break
      }
    }

    // Case 2: Vehicle hasn't returned home → use end of last trip
    if (destinationLat === 0 && destinationLng === 0) {
      const lastTrip = trips[trips.length - 1]
      const lastEndDist = haversine(homeLat, homeLng, lastTrip.endLat, lastTrip.endLng)
      if (lastEndDist > HOME_RADIUS_KM) {
        destinationLat = lastTrip.endLat
        destinationLng = lastTrip.endLng
      } else {
        // All trips near home, use start of longest trip
        const longest = [...trips].sort((a: any, b: any) => b.distance - a.distance)[0]
        if (longest && longest.distance > 3) {
          const startDist = haversine(homeLat, homeLng, longest.startLat, longest.startLng)
          const endDist = haversine(homeLat, homeLng, longest.endLat, longest.endLng)
          if (endDist > startDist) {
            destinationLat = longest.endLat
            destinationLng = longest.endLng
          } else {
            destinationLat = longest.startLat
            destinationLng = longest.startLng
          }
        }
      }
    }

    // Geocode
    let destination = ""
    if (destinationLat !== 0 && destinationLng !== 0) {
      destination = await getCityName(destinationLat, destinationLng)
    }

    return { hadTrips: true, destination }
  } catch {
    return { hadTrips: false }
  }
}

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

    // Parse nav points (same logic as history page)
    const navPoints = parseNavPoints(text)
    if (navPoints.length < 5) return { hadTrips: false }

    // Build trips (same logic as history page)
    const trips = buildTrips(navPoints)
    if (trips.length === 0) return { hadTrips: false }

    // Find the start point (home)
    const homeLat = navPoints[0].lat
    const homeLng = navPoints[0].lng
    const HOME_RADIUS_KM = 5

    // Find the last trip that ENDS near home (= return trip)
    // The START of that trip is the unloading/destination point
    let destinationLat = 0
    let destinationLng = 0

    for (let i = trips.length - 1; i >= 0; i--) {
      const endDist = haversine(homeLat, homeLng, trips[i].endLat, trips[i].endLng)
      const startDist = haversine(homeLat, homeLng, trips[i].startLat, trips[i].startLng)
      
      // This trip ends near home AND starts far from home = return trip
      if (endDist <= HOME_RADIUS_KM && startDist > HOME_RADIUS_KM) {
        destinationLat = trips[i].startLat
        destinationLng = trips[i].startLng
        break
      }
    }

    // Fallback: vehicle hasn't returned home yet
    // Use the END point of the last trip (= where vehicle currently is / last destination)
    if (destinationLat === 0 && destinationLng === 0) {
      const lastTrip = trips[trips.length - 1]
      if (lastTrip && lastTrip.distance > 3) {
        const lastEndDist = haversine(homeLat, homeLng, lastTrip.endLat, lastTrip.endLng)
        if (lastEndDist > HOME_RADIUS_KM) {
          // Vehicle is still far from home - use end of last trip
          destinationLat = lastTrip.endLat
          destinationLng = lastTrip.endLng
        } else {
          // Last trip ended near home but no clear return trip found
          // Use start of last long trip
          destinationLat = lastTrip.startLat
          destinationLng = lastTrip.startLng
        }
      }
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
    // Allow date override for testing: ?date=2026-05-21
    const today = searchParams.get("date") || wibNow.toISOString().split("T")[0]

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

      if (vehicle && (vehicle.id || vehicle.vehicleId)) {
        // Use UUID id for history API, numeric vehicleId as fallback
        const vid = vehicle.id || String(vehicle.vehicleId)
        const result = await vehicleHadTripsToday(glonassToken, vid, today)
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
      details: notifications.map(n => ({ driver: n.driver, destination: n.destination })),
      debug: {
        vehiclesFound: vehicles.length,
        driversWithVehicles: (driverVehicles || []).length,
      },
    })
  } catch (error) {
    console.error("Deposit reminder cron error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
