import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vehicle = searchParams.get("vehicle")

    let query = "SELECT id, document_id, vehicle, driver, type, DATE_FORMAT(previous_expiry, '%Y-%m-%d') AS previous_expiry, DATE_FORMAT(new_expiry, '%Y-%m-%d') AS new_expiry, cost, created_at FROM document_renewals"
    const params: any[] = []

    if (vehicle) {
      query += " WHERE vehicle = ?"
      params.push(vehicle)
    }

    query += " ORDER BY created_at DESC"

    const [rows] = await pool.execute(query, params)
    return NextResponse.json(rows)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const connection = await pool.getConnection()
  try {
    const body = await request.json()
    const { document_id, driver, new_expiry, cost } = body

    if (!document_id || !driver || !new_expiry || cost === undefined) {
      return NextResponse.json({ error: "Kolom document_id, supir, tanggal baru, dan biaya wajib diisi" }, { status: 400 })
    }

    await connection.beginTransaction()

    // 1. Get current document details
    const [docs] = await connection.execute(
      "SELECT vehicle, type, expiry FROM documents WHERE id = ? FOR UPDATE",
      [document_id]
    ) as any[]

    if (docs.length === 0) {
      await connection.rollback()
      return NextResponse.json({ error: "Data dokumen tidak ditemukan" }, { status: 404 })
    }

    const { vehicle, type, expiry: previous_expiry } = docs[0]

    // Format previous_expiry date for insertion (e.g. YYYY-MM-DD)
    let formattedPrevExpiry = null
    if (previous_expiry) {
      formattedPrevExpiry = new Date(previous_expiry).toISOString().split("T")[0]
    }

    // 2. Update the document's expiry date
    await connection.execute(
      "UPDATE documents SET expiry = ? WHERE id = ?",
      [new_expiry, document_id]
    )

    // 3. Log the renewal history
    const [result] = await connection.execute(
      "INSERT INTO document_renewals (document_id, vehicle, driver, type, previous_expiry, new_expiry, cost) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        document_id,
        vehicle,
        driver.trim(),
        type,
        formattedPrevExpiry,
        new_expiry,
        parseInt(String(cost))
      ]
    ) as any

    await connection.commit()
    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 })
  } catch (error) {
    await connection.rollback()
    return NextResponse.json({ error: String(error) }, { status: 500 })
  } finally {
    connection.release()
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Parameter id wajib disertakan" }, { status: 400 })
    }

    await pool.execute("DELETE FROM document_renewals WHERE id = ?", [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
