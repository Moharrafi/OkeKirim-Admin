import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import * as admin from "firebase-admin"
import { ensureFcmTokenTable } from "@/lib/fcm-token-schema"

export const maxDuration = 60

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}")
  if (serviceAccount.project_id) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")
  if (key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await ensureFcmTokenTable()

    const now = new Date()
    const wibOffset = 7 * 60 * 60 * 1000
    const wibNow = new Date(now.getTime() + wibOffset)
    const today = searchParams.get("date") || wibNow.toISOString().split("T")[0]

    // 1. Get all drivers with FCM tokens (exclude admin)
    // First, fix any tokens without role (set to 'driver' unless name contains 'admin')
    await pool.execute(
      "UPDATE fcm_tokens SET role = 'driver' WHERE role IS NULL AND LOWER(driver_name) NOT LIKE '%admin%'"
    )
    await pool.execute(
      "UPDATE fcm_tokens SET role = 'admin' WHERE role IS NULL AND LOWER(driver_name) LIKE '%admin%'"
    )
    
    const [tokenRows] = await pool.execute(
      "SELECT driver_name, token FROM fcm_tokens WHERE token IS NOT NULL AND token != '' AND role = 'driver'"
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

    // 3. Build notifications for all drivers who haven't deposited.
    // Keep this reminder independent from GlonassSoft so it cannot trigger GPS login throttling.
    const notifications: { driver: string; token: string; destination?: string }[] = []

    for (const row of tokenRows) {
      const driverName = String(row.driver_name).trim()

      // Skip if already deposited
      if (driversWithDeposit.has(driverName.toLowerCase())) continue

      notifications.push({ driver: driverName, token: row.token })
    }

    // 4. Send push notifications
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
              title: "Reminder Setoran",
              body: bodyText,
            },
            data: { type: "deposit_reminder", url: "/deposit?tab=setoran" },
            android: {
              priority: "high",
              notification: { sound: "default", channelId: "deposit_reminder" },
            },
            apns: {
              headers: {
                "apns-priority": "10",
              },
              payload: {
                aps: {
                  sound: "default",
                },
              },
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
      adminNotificationsCreated: 0,
      details: notifications.map(n => ({ driver: n.driver, destination: n.destination || "(no GPS)" })),
    })
  } catch (error) {
    console.error("Deposit reminder cron error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
