import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { ensureFcmTokenTable } from "@/lib/fcm-token-schema"

export async function POST(request: NextRequest) {
  try {
    await ensureFcmTokenTable()

    const { driverName, token, role } = await request.json()

    if (!driverName || !token) {
      return NextResponse.json({ error: "driverName and token required" }, { status: 400 })
    }

    const normalizedDriverName = String(driverName).trim()
    if (!normalizedDriverName) {
      return NextResponse.json({ error: "driverName required" }, { status: 400 })
    }

    const userRole = role === "admin" ? "admin" : "driver"

    await pool.execute(
      "DELETE FROM fcm_tokens WHERE token = ? AND driver_name <> ?",
      [token, normalizedDriverName]
    )

    await pool.execute(
      `INSERT INTO fcm_tokens (driver_name, token, role, updated_at) 
       VALUES (?, ?, ?, NOW()) 
       ON DUPLICATE KEY UPDATE token = VALUES(token), role = VALUES(role), updated_at = NOW()`,
      [normalizedDriverName, token, userRole]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("FCM token save error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureFcmTokenTable()

    const { driverName, token } = await request.json()

    if (!driverName && !token) {
      return NextResponse.json({ error: "driverName or token required" }, { status: 400 })
    }

    if (token) {
      await pool.execute(
        "DELETE FROM fcm_tokens WHERE token = ?",
        [token]
      )
    } else {
      await pool.execute(
        "DELETE FROM fcm_tokens WHERE driver_name = ?",
        [String(driverName).trim()]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("FCM token delete error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
