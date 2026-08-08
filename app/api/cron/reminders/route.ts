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
    // 2. LOGIKA DEPOSIT REMINDER (1x SEHARI SAAT JALAN)
    // ==========================================
    try {
      const now = new Date()
      const wibOffset = 7 * 60 * 60 * 1000
      const wibNow = new Date(now.getTime() + wibOffset)
      const today = searchParams.get("date") || wibNow.toISOString().split("T")[0]

      // Ensure reminder log table exists
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS daily_reminder_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          driver_name VARCHAR(128) NOT NULL,
          reminder_date DATE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY idx_driver_date (driver_name, reminder_date)
        )
      `)

      await pool.execute(
        "UPDATE fcm_tokens SET role = 'driver' WHERE role IS NULL AND LOWER(driver_name) NOT LIKE '%admin%'"
      )
      await pool.execute(
        "UPDATE fcm_tokens SET role = 'admin' WHERE role IS NULL AND LOWER(driver_name) LIKE '%admin%'"
      )

      // Fetch FCM tokens map
      const [tokenRows] = await pool.execute(
        "SELECT driver_name, token FROM fcm_tokens WHERE token IS NOT NULL AND token != ''"
      ) as any

      const fcmTokenMap = new Map<string, string>()
      ;(tokenRows || []).forEach((r: any) => {
        if (r.driver_name && r.token) {
          fcmTokenMap.set(String(r.driver_name).trim().toLowerCase(), String(r.token))
        }
      })

      // Fetch all active drivers from drivers table or fallback to FCM tokens
      let driverList: string[] = []
      try {
        const [driverRows] = await pool.execute(
          "SELECT DISTINCT name FROM drivers WHERE status = 'aktif' OR status IS NULL"
        ) as any
        driverList = (driverRows || []).map((r: any) => String(r.name).trim())
      } catch {}

      if (driverList.length === 0 && tokenRows && tokenRows.length > 0) {
        driverList = (tokenRows || []).map((r: any) => String(r.driver_name).trim())
      }

      // If still empty (e.g. initial dev DB), include default drivers
      if (driverList.length === 0) {
        driverList = ["Pudini", "Budi", "Driver Test"]
      }

      let depositSent = 0
      const depositDetails: any[] = []

      // Cek driver yang sudah LUNAS hari ini
      const [depositRows] = await pool.execute(
        "SELECT DISTINCT driver FROM schedules WHERE date = ? AND status = 'lunas'",
        [today]
      ) as any

      const driversWithDeposit = new Set(
        (depositRows || []).map((r: any) => String(r.driver).trim().toLowerCase())
      )

      // Cek driver yang SUDAH dikirimi notifikasi 1x hari ini
      const isManual = searchParams.get("key") === "manual"
      let driversAlreadyReminded = new Set<string>()

      if (!isManual) {
        const [alreadySentRows] = await pool.execute(
          "SELECT driver_name FROM daily_reminder_logs WHERE reminder_date = ?",
          [today]
        ) as any

        driversAlreadyReminded = new Set(
          (alreadySentRows || []).map((r: any) => String(r.driver_name).trim().toLowerCase())
        )
      }

      const customBodyText = "Hari ini narik ? jangan lupa setoran yah"

      for (const driverName of driverList) {
        const driverLower = driverName.toLowerCase()

        // Syarat 1: Belum bayar setoran hari ini
        if (driversWithDeposit.has(driverLower)) continue

        // Syarat 2: Belum pernah dikirim notifikasi hari ini (1x SAJA PER HARI, kecuali manual test)
        if (!isManual && driversAlreadyReminded.has(driverLower)) continue

        const token = fcmTokenMap.get(driverLower)

        try {
          // 1. Kirim Push Notification via FCM jika token & Firebase terkonfigurasi
          if (admin.apps.length > 0 && token) {
            await admin.messaging().send({
              token: token,
              notification: {
                title: "Reminder Setoran",
                body: customBodyText,
              },
              data: { type: "deposit_reminder", url: "/deposit?tab=setoran", sound: "setoran_reminder" },
              android: {
                priority: "high",
                notification: {
                  sound: "setoran_reminder",
                  channelId: "deposit_reminder_custom",
                  defaultSound: false,
                },
              },
              apns: {
                headers: { "apns-priority": "10" },
                payload: { aps: { sound: "setoran_reminder.caf" } },
              },
            })
          }

          // 2. Simpan ke database In-App Notifications (tampil di lonceng aplikasi untuk role driver & admin)
          await pool.execute(
            "INSERT INTO notifications (target_role, title, body, type, data) VALUES (?, ?, ?, ?, ?)",
            [
              "driver",
              "Reminder Setoran",
              `Halo ${driverName}, ${customBodyText}`,
              "deposit_reminder",
              JSON.stringify({ url: "/deposit?tab=setoran", driver: driverName }),
            ]
          )

          // 3. Catat di log agar TIDAK AKAN dikirim 2x pada hari yang sama
          await pool.execute(
            "INSERT IGNORE INTO daily_reminder_logs (driver_name, reminder_date) VALUES (?, ?)",
            [driverName, today]
          )

          depositSent++
          depositDetails.push({ driver: driverName, fcmSent: Boolean(token), status: "sent", message: customBodyText })
        } catch (err: any) {
          if (token && err?.code === "messaging/registration-token-not-registered") {
            await pool.execute("DELETE FROM fcm_tokens WHERE token = ?", [token])
          }
          console.error(`Failed to send deposit notification to ${driverName}:`, err)
          depositDetails.push({ driver: driverName, status: "failed", error: String(err) })
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
