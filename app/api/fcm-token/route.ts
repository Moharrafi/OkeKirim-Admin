import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { driverName, token } = await request.json()

    if (!driverName || !token) {
      return NextResponse.json({ error: "driverName and token required" }, { status: 400 })
    }

    await pool.execute(
      `INSERT INTO fcm_tokens (driver_name, token, updated_at) 
       VALUES (?, ?, NOW()) 
       ON DUPLICATE KEY UPDATE token = VALUES(token), updated_at = NOW()`,
      [driverName, token]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("FCM token save error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
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
