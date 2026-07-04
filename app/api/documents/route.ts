import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vehicle = searchParams.get("vehicle")

    let query = "SELECT id, vehicle, type, DATE_FORMAT(expiry, '%Y-%m-%d') AS expiry, renewalCost, created_at FROM documents"
    const params: any[] = []

    if (vehicle) {
      query += " WHERE vehicle = ?"
      params.push(vehicle)
    }

    query += " ORDER BY expiry ASC"

    const [rows] = await pool.execute(query, params)
    return NextResponse.json(rows)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vehicle, type, expiry, renewalCost } = body

    if (!vehicle || !type || !expiry) {
      return NextResponse.json({ error: "Kolom plat nomor, jenis dokumen, dan tanggal kedaluwarsa wajib diisi" }, { status: 400 })
    }

    const [result] = await pool.execute(
      "INSERT INTO documents (vehicle, type, expiry, renewalCost) VALUES (?, ?, ?, ?)",
      [
        vehicle.trim().toUpperCase(),
        type.trim(),
        expiry,
        renewalCost ? parseInt(String(renewalCost)) : 0
      ]
    ) as any

    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, vehicle, type, expiry, renewalCost } = body

    if (!id || !vehicle || !type || !expiry) {
      return NextResponse.json({ error: "id, plat nomor, jenis dokumen, dan tanggal kedaluwarsa wajib diisi" }, { status: 400 })
    }

    await pool.execute(
      "UPDATE documents SET vehicle = ?, type = ?, expiry = ?, renewalCost = ? WHERE id = ?",
      [
        vehicle.trim().toUpperCase(),
        type.trim(),
        expiry,
        renewalCost ? parseInt(String(renewalCost)) : 0,
        id
      ]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Parameter id wajib disertakan" }, { status: 400 })
    }

    // Delete renewals associated with this document_id first
    await pool.execute("DELETE FROM document_renewals WHERE document_id = ?", [id])
    await pool.execute("DELETE FROM documents WHERE id = ?", [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
