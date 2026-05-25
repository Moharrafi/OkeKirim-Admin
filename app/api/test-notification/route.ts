import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { ensureFcmTokenTable } from "@/lib/fcm-token-schema"
import { ensureNotificationsTable } from "@/lib/notifications-schema"
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
 * Test endpoint: send a push notification to a specific driver/admin.
 * Usage: POST /api/test-notification
 * Body: { "driverName": "Nama Driver" } or {} to send to all
 */
export async function POST(request: NextRequest) {
  try {
    await ensureFcmTokenTable()
    await ensureNotificationsTable()

    const body = await request.json().catch(() => ({})) as { driverName?: string }
    const title = "Test Notifikasi OkeMitra"
    const type = "test"
    const url = "/notifications"

    let tokenRows: any[]
    if (body.driverName) {
      const [rows] = await pool.execute(
        "SELECT driver_name, role, token FROM fcm_tokens WHERE driver_name = ?",
        [body.driverName]
      ) as any
      tokenRows = rows
    } else {
      const [rows] = await pool.execute(
        "SELECT driver_name, role, token FROM fcm_tokens WHERE token IS NOT NULL AND token != ''"
      ) as any
      tokenRows = rows
    }

    if (!tokenRows || tokenRows.length === 0) {
      return NextResponse.json({
        error: "No FCM tokens found. Driver needs to login from APK first.",
        hint: "Install APK -> login as driver/admin -> token will be registered automatically",
      }, { status: 404 })
    }

    if (!admin.apps.length) {
      return NextResponse.json({
        error: "Firebase not configured. Set FIREBASE_SERVICE_ACCOUNT env variable.",
      }, { status: 500 })
    }

    let sentCount = 0
    let sentAdminCount = 0
    const results: any[] = []

    for (const row of tokenRows) {
      const messageBody = `Halo ${row.driver_name}! Ini test push notification. Kalau muncul berarti berhasil!`

      try {
        const response = await admin.messaging().send({
          token: row.token,
          notification: {
            title,
            body: messageBody,
          },
          data: { type, url },
          android: {
            priority: "high",
            notification: { sound: "default", channelId: "deposit_reminder" },
          },
        })

        sentCount++
        if (row.role === "admin") {
          sentAdminCount++
        }
        results.push({ driver: row.driver_name, role: row.role, status: "sent", messageId: response })
      } catch (err: any) {
        results.push({ driver: row.driver_name, role: row.role, status: "failed", error: err.message })
      }
    }

    if (sentAdminCount > 0) {
      await pool.execute(
        `INSERT INTO notifications (target_role, title, body, type, data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          "admin",
          title,
          `Test push berhasil dikirim ke ${sentAdminCount} perangkat admin.`,
          type,
          JSON.stringify({ url, sentAdminCount: String(sentAdminCount) }),
        ]
      )
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      loggedAdminNotification: sentAdminCount > 0,
      total: tokenRows.length,
      results,
    })
  } catch (error) {
    console.error("Test notification error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
