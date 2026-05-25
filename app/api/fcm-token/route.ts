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

    const userRole = role || "driver"

    await pool.execute(
      `INSERT INTO fcm_tokens (driver_name, token, role, updated_at) 
       VALUES (?, ?, ?, NOW()) 
       ON DUPLICATE KEY UPDATE token = VALUES(token), role = VALUES(role), updated_at = NOW()`,
      [driverName, token, userRole]
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

    const { driverName } = await request.json()

    if (!driverName) {
      return NextResponse.json({ error: "driverName required" }, { status: 400 })
    }

    await pool.execute(
      "DELETE FROM fcm_tokens WHERE driver_name = ?",
      [driverName]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("FCM token delete error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
