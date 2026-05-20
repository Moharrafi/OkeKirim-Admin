import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

// Simple in-memory cache (TTL: 20 seconds)
const historyCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 20_000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const driver = searchParams.get("driver")
  const dateFrom = searchParams.get("from")
  const dateTo = searchParams.get("to")

  const cacheKey = `history_${driver}_${dateFrom}_${dateTo}`
  const cached = historyCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  try {
    let query = `
      SELECT s.*, d.vehicle as driverVehicle 
      FROM schedules s 
      LEFT JOIN drivers d ON LOWER(TRIM(s.driver)) = LOWER(TRIM(d.name))
      WHERE s.status = 'lunas'
    `
    const params: string[] = []

    if (driver) {
      query += " AND s.driver LIKE ?"
      params.push(`%${driver}%`)
    }

    if (dateFrom) {
      query += " AND s.date >= ?"
      params.push(dateFrom)
    }

    if (dateTo) {
      query += " AND s.date <= ?"
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

    // Update cache
    historyCache.set(cacheKey, { data: responseData, timestamp: Date.now() })
    // Cleanup old entries
    if (historyCache.size > 30) {
      const now = Date.now()
      for (const [k, v] of historyCache) {
        if (now - v.timestamp > CACHE_TTL) historyCache.delete(k)
      }
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("DB Error:", error)
    return NextResponse.json({ error: `Database error: ${error}` }, { status: 500 })
  }
}
