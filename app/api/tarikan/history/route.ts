import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const driver = searchParams.get("driver")
  const dateFrom = searchParams.get("from")
  const dateTo = searchParams.get("to")

  try {
    let query = `
      SELECT s.*, d.vehicle as driverVehicle 
      FROM schedules s 
      LEFT JOIN drivers d ON LOWER(TRIM(s.driver)) = LOWER(TRIM(d.name))
      WHERE s.status = 'lunas'
    `
    const params: string[] = []
    const paidAtExpr = "COALESCE(s.paidOffAt, s.lastPaidAt, s.date)"
    const paidAtJakartaDateExpr = `DATE(DATE_ADD(${paidAtExpr}, INTERVAL 7 HOUR))`

    if (driver) {
      query += " AND s.driver LIKE ?"
      params.push(`%${driver}%`)
    }

    if (dateFrom) {
      query += ` AND ${paidAtJakartaDateExpr} >= ?`
      params.push(dateFrom)
    }

    if (dateTo) {
      query += ` AND ${paidAtJakartaDateExpr} <= ?`
      params.push(dateTo)
    }

    query += " ORDER BY s.paidOffAt DESC, s.id DESC"

    const [rows] = await pool.execute(query, params)

    const history = (rows as Array<Record<string, unknown>>).map(row => ({
      ...row,
      vehicle: row.vehicle || row.driverVehicle || null,
    }))

    const responseData = {
      history,
      count: history.length,
    }

    return NextResponse.json(responseData, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("DB Error:", error)
    return NextResponse.json({ error: `Database error: ${error}` }, { status: 500 })
  }
}
