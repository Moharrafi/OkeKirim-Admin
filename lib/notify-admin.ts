import pool from "@/lib/db"
import { ensureFcmTokenTable } from "@/lib/fcm-token-schema"
import { ensureNotificationsTable } from "@/lib/notifications-schema"
import * as admin from "firebase-admin"

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}")
  if (serviceAccount.project_id) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }
}

interface NotifyAdminOptions {
  title: string
  body: string
  type?: string
  data?: Record<string, string>
}

/**
 * Send push notification to all admin users and log it to the notifications table.
 */
export async function notifyAdmins(options: NotifyAdminOptions) {
  const { title, body, type = "info", data = {} } = options

  try {
    await ensureNotificationsTable()
    await ensureFcmTokenTable()

    // 1. Log notification to database
    await pool.execute(
      `INSERT INTO notifications (target_role, title, body, type, data, created_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      ["admin", title, body, type, JSON.stringify(data)]
    )

    // 2. Get all admin FCM tokens
    const [tokenRows] = await pool.execute(
      "SELECT driver_name, token FROM fcm_tokens WHERE role = 'admin' AND token IS NOT NULL AND token != ''"
    ) as any

    if (!tokenRows || tokenRows.length === 0) {
      return { logged: true, sent: 0 }
    }

    // 3. Send push notifications
    let sentCount = 0
    if (admin.apps.length > 0) {
      const uniqueTokenRows = Array.from(
        new Map(tokenRows.map((row: any) => [row.token, row])).values()
      ) as any[]

      for (const row of uniqueTokenRows) {
        try {
          await admin.messaging().send({
            token: row.token,
            notification: { title, body },
            data: { type, url: data.url || "/deposit", ...data },
            android: {
              priority: "high",
              notification: { sound: "default", channelId: "admin_notifications" },
            },
          })
          sentCount++
        } catch (err: any) {
          // Remove invalid tokens
          if (err?.code === "messaging/registration-token-not-registered") {
            await pool.execute("DELETE FROM fcm_tokens WHERE token = ?", [row.token])
          }
          console.error(`Failed to notify admin ${row.driver_name}:`, err)
        }
      }
    }

    return { logged: true, sent: sentCount }
  } catch (error) {
    console.error("notifyAdmins error:", error)
    return { logged: false, sent: 0 }
  }
}

/**
 * Notify admins when a driver makes a deposit payment.
 */
export async function notifyDepositPayment(driverName: string, amount: number, orderCount: number = 1) {
  const formattedAmount = `Rp ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`

  const title = "Setoran Masuk"
  const body = orderCount > 1
    ? `${driverName} melakukan setoran ${formattedAmount} untuk ${orderCount} orderan`
    : `${driverName} melakukan setoran sebesar ${formattedAmount}`

  return notifyAdmins({
    title,
    body,
    type: "deposit_payment",
    data: { driver: driverName, amount: String(amount), url: "/history" },
  })
}

/**
 * Notify admins when a new order is created.
 */
export async function notifyNewOrder(driverName: string, origin: string, destination: string, fare: number) {
  const formattedFare = `Rp ${fare.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`

  const title = "Orderan Baru"
  const body = `${driverName} input orderan ${origin} -> ${destination} (${formattedFare})`

  return notifyAdmins({
    title,
    body,
    type: "new_order",
    data: { driver: driverName, url: "/deposit?tab=setoran" },
  })
}
