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

async function vehicleHadTripsToday(token: string, vehicleId: number): Promise<boolean> {
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
    if (!resp.ok) return false
    const text = await resp.text()
    if (!text || !text.includes("&")) return false

    const clean = text.replace(/^"|"$/g, "")
    const ampIdx = clean.indexOf("&")
    if (ampIdx === -1) return false
    const dataPart = clean.substring(ampIdx + 1)
    const segments = dataPart.split(":")

    let movingPoints = 0
    for (const s of segments) {
      if (!s) continue
      const parts = s.split(",")
      if (parts.length > 3 && parseFloat(parts[3]) > 3) movingPoints++
    }

    return movingPoints > 10
  } catch {
    return false
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
    const notifications: { driver: string; token: string }[] = []

    for (const row of tokenRows) {
      const driverName = String(row.driver_name).trim()

      if (driversWithDeposit.has(driverName.toLowerCase())) continue

      const vehicle = vehicles.find((v: any) => {
        const vName = (v.number || v.Name || v.name || "").toLowerCase()
        return vName.includes(driverName.toLowerCase()) || driverName.toLowerCase().includes(vName)
      })

      if (vehicle && vehicle.vehicleId) {
        const hadTrips = await vehicleHadTripsToday(glonassToken, vehicle.vehicleId)
        if (hadTrips) {
          notifications.push({ driver: driverName, token: row.token })
        }
        await new Promise(r => setTimeout(r, 600))
      }
    }

    let sentCount = 0
    if (admin.apps.length > 0 && notifications.length > 0) {
      for (const notif of notifications) {
        try {
          await admin.messaging().send({
            token: notif.token,
            notification: {
              title: "🚛 Reminder Setoran",
              body: `Halo ${notif.driver}, hari ini Anda narik? Segera lakukan setoran ya!`,
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
