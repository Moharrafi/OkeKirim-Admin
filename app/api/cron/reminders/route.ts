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

  const results: any = {
    arrears: null,
    deposit: null,
  }

  try {
    await ensureFcmTokenTable()

    // ==========================================
    // 1. LOGIKA ARREARS REMINDER (TUNGGAKAN)
    // ==========================================
    try {
      const arrearsQuery = `
        SELECT 
          s.driver,
          COUNT(*) as pendingCount,
          SUM(CAST(s.companyShare AS SIGNED) - CAST(s.paidCompanyAmount AS SIGNED)) as pendingTotal,
          t.token
        FROM schedules s
        JOIN fcm_tokens t ON s.driver COLLATE utf8mb4_general_ci = t.driver_name COLLATE utf8mb4_general_ci
        WHERE s.status = 'nunggak'
          AND t.token IS NOT NULL
          AND t.token != ''
        GROUP BY s.driver, t.token
      `
      const [arrearsRows] = await pool.execute(arrearsQuery) as any
      let arrearsSent = 0
      const arrearsDetails: any[] = []

      if (admin.apps.length > 0 && arrearsRows && arrearsRows.length > 0) {
        for (const row of arrearsRows) {
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
                headers: { "apns-priority": "10" },
                payload: { aps: { sound: "default" } },
              },
            })
            arrearsSent++
            arrearsDetails.push({ driver: driverName, pendingCount, pendingTotal, status: "sent" })
          } catch (err: any) {
            if (err?.code === "messaging/registration-token-not-registered") {
              await pool.execute("DELETE FROM fcm_tokens WHERE token = ?", [token])
            }
            console.error(`Failed to send arrears notification to ${driverName}:`, err)
            arrearsDetails.push({ driver: driverName, pendingCount, pendingTotal, status: "failed", error: String(err) })
          }
        }
      }
      results.arrears = { success: true, sent: arrearsSent, details: arrearsDetails }
    } catch (arrearsErr: any) {
      console.error("Arrears reminder helper error:", arrearsErr)
      results.arrears = { success: false, error: String(arrearsErr) }
    }

    // ==========================================
    // 2. LOGIKA DEPOSIT REMINDER (SETORAN HARIAN)
    // ==========================================
    try {
      const now = new Date()
      const wibOffset = 7 * 60 * 60 * 1000
      const wibNow = new Date(now.getTime() + wibOffset)
      const today = searchParams.get("date") || wibNow.toISOString().split("T")[0]

      await pool.execute(
        "UPDATE fcm_tokens SET role = 'driver' WHERE role IS NULL AND LOWER(driver_name) NOT LIKE '%admin%'"
      )
      await pool.execute(
        "UPDATE fcm_tokens SET role = 'admin' WHERE role IS NULL AND LOWER(driver_name) LIKE '%admin%'"
      )
      
      const [tokenRows] = await pool.execute(
        "SELECT driver_name, token FROM fcm_tokens WHERE token IS NOT NULL AND token != '' AND role = 'driver'"
      ) as any

      let depositSent = 0
      const depositDetails: any[] = []

      if (tokenRows && tokenRows.length > 0) {
        const [depositRows] = await pool.execute(
          "SELECT DISTINCT driver FROM schedules WHERE date = ? AND status = 'lunas'",
          [today]
        ) as any

        const driversWithDeposit = new Set(
          (depositRows || []).map((r: any) => String(r.driver).trim().toLowerCase())
        )

        const notifications: { driver: string; token: string }[] = []
        for (const row of tokenRows) {
          const driverName = String(row.driver_name).trim()
          if (driversWithDeposit.has(driverName.toLowerCase())) continue
          notifications.push({ driver: driverName, token: row.token })
        }

        if (admin.apps.length > 0 && notifications.length > 0) {
          for (const notif of notifications) {
            const bodyText = `Halo ${notif.driver}, sudah narik hari ini? Segera lakukan setoran ya! 🙏`
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
                  headers: { "apns-priority": "10" },
                  payload: { aps: { sound: "default" } },
                },
              })
              depositSent++
              depositDetails.push({ driver: notif.driver, status: "sent" })
            } catch (err: any) {
              if (err?.code === "messaging/registration-token-not-registered") {
                await pool.execute("DELETE FROM fcm_tokens WHERE token = ?", [notif.token])
              }
              console.error(`Failed to send deposit notification to ${notif.driver}:`, err)
              depositDetails.push({ driver: notif.driver, status: "failed", error: String(err) })
            }
          }
        }
      }
      results.deposit = { success: true, sent: depositSent, details: depositDetails }
    } catch (depositErr: any) {
      console.error("Deposit reminder helper error:", depositErr)
      results.deposit = { success: false, error: String(depositErr) }
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error("Combined reminder cron error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
