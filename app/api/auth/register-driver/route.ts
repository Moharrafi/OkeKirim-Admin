import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    // Ensure password_hash column exists
    try {
      await pool.execute("ALTER TABLE drivers ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL")
    } catch {
      // Column already exists, ignore
    }

    const body = await request.json()
    const { driverId, password } = body

    if (!driverId || !password) {
      return NextResponse.json(
        { success: false, message: "Driver dan password wajib diisi" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: "Password minimal 6 karakter" },
        { status: 400 }
      )
    }

    // Check if driver exists
    const [rows] = await pool.execute(
      "SELECT id, name, password_hash FROM drivers WHERE id = ?",
      [driverId]
    ) as any

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Driver tidak ditemukan" },
        { status: 404 }
      )
    }

    const driver = rows[0]

    // Check if driver already registered
    if (driver.password_hash) {
      return NextResponse.json(
        { success: false, message: "Driver sudah terdaftar. Silakan login." },
        { status: 409 }
      )
    }

    // Hash password and store
    const hash = await bcrypt.hash(password, 10)
    await pool.execute(
      "UPDATE drivers SET password_hash = ? WHERE id = ?",
      [hash, driverId]
    )

    return NextResponse.json({
      success: true,
      message: "Registrasi berhasil! Silakan login dengan password baru Anda.",
    })
  } catch (error) {
    console.error("Register driver error:", error)
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}
