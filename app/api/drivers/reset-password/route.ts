import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "ID driver wajib diisi" }, { status: 400 })
    }

    // Set password_hash to NULL in the database
    const [result] = await pool.execute(
      "UPDATE drivers SET password_hash = NULL WHERE id = ?",
      [id]
    ) as any

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Driver tidak ditemukan" }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Password driver berhasil di-reset" })
  } catch (error) {
    console.error("Reset password driver error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}
