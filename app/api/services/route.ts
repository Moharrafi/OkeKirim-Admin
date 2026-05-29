import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (id) {
      const [rows] = await pool.execute(
        "SELECT * FROM services WHERE id = ? LIMIT 1",
        [id]
      ) as any
      return NextResponse.json({ service: rows?.[0] || null })
    }

    const [rows] = await pool.execute(`
      SELECT
        id,
        vehicle,
        driver,
        type,
        date,
        cost,
        status,
        created_at,
        CASE WHEN receipt IS NOT NULL AND receipt != '' THEN 1 ELSE 0 END AS hasReceipt
      FROM services
      ORDER BY id DESC
    `)
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

    if (Object.prototype.hasOwnProperty.call(body, "receipt")) {
      await pool.execute(
        "UPDATE services SET vehicle=?, driver=?, type=?, date=?, cost=?, status=?, receipt=? WHERE id=?",
        [vehicle || null, driver || null, type || null, date || null, cost || 0, status || "terjadwal", receipt || null, id]
      )
    } else {
      await pool.execute(
        "UPDATE services SET vehicle=?, driver=?, type=?, date=?, cost=?, status=? WHERE id=?",
        [vehicle || null, driver || null, type || null, date || null, cost || 0, status || "terjadwal", id]
      )
    }

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
