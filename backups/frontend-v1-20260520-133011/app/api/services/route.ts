import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET() {
  try {
    const [rows] = await pool.execute("SELECT * FROM services ORDER BY id DESC")
    return NextResponse.json({ services: rows })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vehicle, driver, type, date, cost, status, receipt } = body

    const [result] = await pool.execute(
      "INSERT INTO services (vehicle, driver, type, date, cost, status, receipt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [vehicle || null, driver || null, type || null, date || null, cost || 0, status || "terjadwal", receipt || null]
    ) as any

    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, vehicle, driver, type, date, cost, status, receipt } = body
    if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 })

    await pool.execute(
      "UPDATE services SET vehicle=?, driver=?, type=?, date=?, cost=?, status=?, receipt=? WHERE id=?",
      [vehicle || null, driver || null, type || null, date || null, cost || 0, status || "terjadwal", receipt || null, id]
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

    await pool.execute("DELETE FROM services WHERE id=?", [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
