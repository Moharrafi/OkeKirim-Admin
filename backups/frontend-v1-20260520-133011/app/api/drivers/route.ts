import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET() {
  try {
    const [rows] = await pool.execute("SELECT * FROM drivers ORDER BY name ASC")
    return NextResponse.json({ drivers: rows })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, vehicle, vehicleType, status } = body
    if (!name) return NextResponse.json({ error: "Nama wajib" }, { status: 400 })

    const [result] = await pool.execute(
      "INSERT INTO drivers (name, vehicle, vehicleType, status) VALUES (?, ?, ?, ?)",
      [name, vehicle || null, vehicleType || null, status || "aktif"]
    ) as any

    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, vehicle, vehicleType, status } = body
    if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 })

    await pool.execute(
      "UPDATE drivers SET name=?, vehicle=?, vehicleType=?, status=? WHERE id=?",
      [name, vehicle || null, vehicleType || null, status || "aktif", id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 })

    await pool.execute("DELETE FROM drivers WHERE id=?", [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
