import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import * as admin from "firebase-admin"

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}")
  if (serviceAccount.project_id) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }
}

/**
 * Test endpoint: send a push notification to a specific driver.
 * Usage: POST /api/test-notification
 * Body: { "driverName": "Nama Driver" } or {} to send to all
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { driverName?: string }

    // Get FCM tokens
    let tokenRows: any[]
    if (body.driverName) {
      const [rows] = await pool.execute(
        "SELECT driver_name, token FROM fcm_tokens WHERE driver_name = ?",
        [body.driverName]
      ) as any
      tokenRows = rows
    } else {
      const [rows] = await pool.execute(
        "SELECT driver_name, token FROM fcm_tokens WHERE token IS NOT NULL AND token != ''"
      ) as any
      tokenRows = rows
    }

    if (!tokenRows || tokenRows.length === 0) {
      return NextResponse.json({ 
        error: "No FCM tokens found. Driver needs to login from APK first.",
        hint: "Install APK → login as driver → token will be registered automatically"
      }, { status: 404 })
    }

    if (!admin.apps.length) {
      return NextResponse.json({ 
        error: "Firebase not configured. Set FIREBASE_SERVICE_ACCOUNT env variable." 
      }, { status: 500 })
    }

    // Send test notification
    let sentCount = 0
    const results: any[] = []

    for (const row of tokenRows) {
      try {
        const response = await admin.messaging().send({
          token: row.token,
          notification: {
            title: "🔔 Test Notifikasi OkeMitra",
            body: `Halo ${row.driver_name}! Ini test push notification. Kalau muncul berarti berhasil!`,
          },
          data: { type: "test", url: "/deposit" },
          android: {
            priority: "high",
            notification: { sound: "default", channelId: "deposit_reminder" },
          },
        })
        sentCount++
        results.push({ driver: row.driver_name, status: "sent", messageId: response })
      } catch (err: any) {
        results.push({ driver: row.driver_name, status: "failed", error: err.message })
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      total: tokenRows.length,
      results,
    })
  } catch (error) {
    console.error("Test notification error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
