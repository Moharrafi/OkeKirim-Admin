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

function formatRupiah(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")
  if (key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await ensureFcmTokenTable()

    // Query all drivers who have outstanding arrears (status = 'nunggak') and have registered FCM tokens.
    // We group by driver and token to send a single notification combining their total pending count and total amount.
    const query = `
      SELECT 
        s.driver,
        COUNT(*) as pendingCount,
        SUM(CAST(s.companyShare AS SIGNED) - CAST(s.paidCompanyAmount AS SIGNED)) as pendingTotal,
        t.token
      FROM schedules s
      JOIN fcm_tokens t ON LOWER(TRIM(s.driver)) = LOWER(TRIM(t.driver_name)) COLLATE utf8mb4_general_ci
      WHERE s.status = 'nunggak'
        AND t.token IS NOT NULL
        AND t.token != ''
      GROUP BY s.driver, t.token
    `

    const [rows] = await pool.execute(query) as any

    if (!rows || rows.length === 0) {
      return NextResponse.json({ message: "No drivers with pending arrears or FCM tokens", sent: 0 })
    }

    let sentCount = 0
    const details: any[] = []

    if (admin.apps.length > 0) {
      for (const row of rows) {
        const driverName = String(row.driver).trim()
        const pendingCount = Number(row.pendingCount || 0)
        const pendingTotal = Number(row.pendingTotal || 0)
        const token = String(row.token)

        const bodyText = `Halo ${driverName}, kamu masih memiliki ${pendingCount} tunggakan setoran dengan total Rp ${formatRupiah(pendingTotal)}. Harap segera dilunasi ya. Terima kasih! 🙏`

        try {
          await admin.messaging().send({
            token: token,
            notification: {
              title: "Tunggakan Setoran",
              body: bodyText,
            },
            data: { type: "arrears_reminder", url: "/deposit?tab=setoran" },
            android: {
              priority: "high",
              notification: { sound: "default", channelId: "arrears_reminder" },
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
          details.push({ driver: driverName, pendingCount, pendingTotal, status: "sent" })
        } catch (err) {
          console.error(`Failed to send arrears notification to ${driverName}:`, err)
          details.push({ driver: driverName, pendingCount, pendingTotal, status: "failed", error: String(err) })
        }
      }
    } else {
      console.warn("Firebase admin not initialized. Skipping sending FCM notifications.")
    }

    return NextResponse.json({
      success: true,
      notificationsSent: sentCount,
      details,
    })
  } catch (error) {
    console.error("Arrears reminder cron error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
