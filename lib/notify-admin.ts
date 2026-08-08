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

    // 3. Send push notifications in parallel to prevent timeouts
    let sentCount = 0
    if (admin.apps.length > 0) {
      const uniqueTokenRows = Array.from(
        new Map(tokenRows.map((row: any) => [row.token, row])).values()
      ) as any[]

      const sendPromises = uniqueTokenRows.map(async (row) => {
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
      })
      await Promise.all(sendPromises)
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
    ? `Anda ( driver ${driverName} ) melakukan setoran ${formattedAmount} untuk ${orderCount} orderan`
    : `Setoran sebesar ${formattedAmount} berhasil dicatat`

  // Log in database strictly for this specific driver
  try {
    await ensureNotificationsTable()
    await pool.execute(
      `INSERT INTO notifications (target_role, title, body, type, data, created_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      ["driver", title, body, "deposit_payment", JSON.stringify({ driver: driverName, amount: String(amount), url: "/history" })]
    )
  } catch (err) {
    console.error("Failed to log deposit notification:", err)
  }

  // Send push notification to admin FCM tokens
  return notifyAdmins({
    title: `Setoran Masuk - ${driverName}`,
    body: `${driverName} melakukan setoran ${formattedAmount}`,
    type: "deposit_payment",
    data: { driver: driverName, amount: String(amount), url: "/history" },
  })
}

/**
 * Notify when a new order is created, storing strictly for the driver account.
 */
export async function notifyNewOrder(driverName: string, origin: string, destination: string, fare: number) {
  const formattedFare = `Rp ${fare.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`

  const title = "Orderan Baru"
  const body = `Input orderan ${origin} -> ${destination} (${formattedFare}) berhasil`

  // Log in database strictly for this specific driver
  try {
    await ensureNotificationsTable()
    await pool.execute(
      `INSERT INTO notifications (target_role, title, body, type, data, created_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      ["driver", title, body, "new_order", JSON.stringify({ driver: driverName, url: "/deposit?tab=setoran" })]
    )
  } catch (err) {
    console.error("Failed to log order notification:", err)
  }

  // Send push notification to admin FCM tokens
  return notifyAdmins({
    title: `Orderan Baru - ${driverName}`,
    body: `${driverName} input orderan ${origin} -> ${destination} (${formattedFare})`,
    type: "new_order",
    data: { driver: driverName, url: "/deposit?tab=setoran" },
  })
}

/**
 * Send push notification to a specific driver.
 * Note: To respect privacy, driver notifications are sent directly via FCM and not logged to the public notifications table.
 */
export async function notifyDriver(
  driverName: string,
  options: { title: string; body: string; type?: string; data?: Record<string, string> }
) {
  const { title, body, type = "info", data = {} } = options

  try {
    await ensureFcmTokenTable()

    // 1. Get all FCM tokens for this specific driver
    const [tokenRows] = await pool.execute(
      "SELECT token FROM fcm_tokens WHERE driver_name = ? AND token IS NOT NULL AND token != ''",
      [driverName]
    ) as any

    if (!tokenRows || tokenRows.length === 0) {
      return { sent: 0 }
    }

    // 2. Send push notifications using Firebase Admin in parallel
    let sentCount = 0
    if (admin.apps.length > 0) {
      const uniqueTokenRows = Array.from(
        new Map(tokenRows.map((row: any) => [row.token, row])).values()
      ) as any[]

      const sendPromises = uniqueTokenRows.map(async (row) => {
        try {
          await admin.messaging().send({
            token: row.token,
            notification: { title, body },
            data: { type, url: data.url || "/hutang", ...data },
            android: {
              priority: "high",
              notification: { sound: "default", channelId: "driver_notifications" },
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
        } catch (err: any) {
          // Remove invalid tokens
          if (err?.code === "messaging/registration-token-not-registered") {
            await pool.execute("DELETE FROM fcm_tokens WHERE token = ?", [row.token])
          }
          console.error(`Failed to notify driver ${driverName} token:`, err)
        }
      })
      await Promise.all(sendPromises)
    }

    return { sent: sentCount }
  } catch (error) {
    console.error("notifyDriver error:", error)
    return { sent: 0 }
  }
}

/**
 * Notify driver when a new kasbon (debt) is created.
 */
export async function notifyNewDebt(driverName: string, amount: number, vehicle?: string) {
  const formattedAmount = `Rp ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
  const title = "Kasbon Baru Diterima"
  const body = `Halo ${driverName}, kasbon baru sebesar ${formattedAmount} telah dicatat ${vehicle ? `untuk kendaraan ${vehicle}` : ""}.`

  return notifyDriver(driverName, {
    title,
    body,
    type: "new_debt",
    data: { amount: String(amount), url: "/hutang" }
  })
}

/**
 * Notify driver when a debt payment (cicilan) is logged.
 */
export async function notifyDebtPayment(driverName: string, amount: number, remaining: number) {
  const formattedAmount = `Rp ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
  const formattedRemaining = `Rp ${remaining.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
  const title = "Pembayaran Kasbon"
  const body = `Pembayaran cicilan kasbon sebesar ${formattedAmount} berhasil dicatat. Sisa kasbon Anda: ${formattedRemaining}.`

  return notifyDriver(driverName, {
    title,
    body,
    type: "debt_payment",
    data: { amount: String(amount), remaining: String(remaining), url: "/hutang" }
  })
}

/**
 * Notify driver when an existing kasbon (debt) is updated.
 */
export async function notifyEditDebt(driverName: string, amount: number, vehicle?: string) {
  const formattedAmount = `Rp ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
  const title = "Kasbon Diperbarui"
  const body = `Halo ${driverName}, data kasbon Anda telah diperbarui. Jumlah pinjaman saat ini: ${formattedAmount}${vehicle ? ` untuk kendaraan ${vehicle}` : ""}.`

  return notifyDriver(driverName, {
    title,
    body,
    type: "edit_debt",
    data: { amount: String(amount), url: "/hutang" }
  })
}

