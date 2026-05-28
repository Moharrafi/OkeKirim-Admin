import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { driverId, password } = body

    if (!driverId || !password) {
      return NextResponse.json(
        { success: false, message: "Driver dan password wajib diisi" },
        { status: 400 }
      )
    }

    // Fetch driver
    const [rows] = await pool.execute(
      "SELECT id, name, vehicle, phone, email, status, password_hash FROM drivers WHERE id = ?",
      [driverId]
    ) as any

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Driver tidak ditemukan" },
        { status: 404 }
      )
    }

    const driver = rows[0]

    // Check if driver has registered (has password_hash)
    if (!driver.password_hash) {
      return NextResponse.json(
        { success: false, message: "Silakan daftar terlebih dahulu", needsRegistration: true },
        { status: 401 }
      )
    }

    // Verify password
    const isValid = await bcrypt.compare(password, driver.password_hash)
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Password salah" },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
        vehicle: driver.vehicle,
        phone: driver.phone,
        email: driver.email,
      },
    })
  } catch (error) {
    console.error("Login driver error:", error)
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}
