import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

function parseDateValue(value: string | null) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : null
}

function addDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const driver = searchParams.get("driver")
  const dateFrom = parseDateValue(searchParams.get("from"))
  const dateTo = parseDateValue(searchParams.get("to"))
  const minDate = parseDateValue(searchParams.get("minDate"))
  const includePending = searchParams.get("includePending") === "true"
  const requestedWindowDays = Number(searchParams.get("windowDays") || 0)
  const windowDays = Number.isFinite(requestedWindowDays)
    ? Math.min(Math.max(Math.trunc(requestedWindowDays), 0), 31)
    : 0
  const requestedLimit = searchParams.get("limit")
  const numericLimit = requestedLimit ? Number(requestedLimit) : null
  const limit = numericLimit && Number.isFinite(numericLimit)
    ? Math.min(Math.max(Math.trunc(numericLimit), 1), 500)
    : null

  try {
    const paidAtExpr = "COALESCE(s.paidOffAt, s.lastPaidAt, s.date)"
    const paidAtJakartaDateExpr = `DATE(DATE_ADD(${paidAtExpr}, INTERVAL 7 HOUR))`
    const statusCondition = includePending ? "s.status IN ('lunas', 'nunggak')" : "s.status = 'lunas'"
    const baseConditions = [statusCondition]
    const baseParams: string[] = []

    if (driver) {
      baseConditions.push("s.driver LIKE ?")
      baseParams.push(`%${driver}%`)
    }

    const lowerBounds = [dateFrom, minDate].filter((value): value is string => Boolean(value))
    const lowerBound = lowerBounds.length > 0 ? lowerBounds.sort()[lowerBounds.length - 1] : null
    let effectiveDateFrom = dateFrom
    let effectiveDateTo = dateTo

    if (windowDays > 0) {
      const latestConditions = [...baseConditions]
      const latestParams = [...baseParams]

      if (lowerBound) {
        latestConditions.push(`${paidAtJakartaDateExpr} >= ?`)
        latestParams.push(lowerBound)
      }

      if (dateTo) {
        latestConditions.push(`${paidAtJakartaDateExpr} <= ?`)
        latestParams.push(dateTo)
      }

      const [latestRows] = await pool.execute(
        `SELECT DATE_FORMAT(MAX(${paidAtJakartaDateExpr}), '%Y-%m-%d') as latestDate
         FROM schedules s
         WHERE ${latestConditions.join(" AND ")}`,
        latestParams
      ) as any

      const windowEnd = latestRows?.[0]?.latestDate || null

      if (windowEnd) {
        const windowStart = addDays(windowEnd, -(windowDays - 1))
        effectiveDateFrom = lowerBound && windowStart < lowerBound ? lowerBound : windowStart
        effectiveDateTo = windowEnd
      }
    }

    if (windowDays > 0 && !effectiveDateTo) {
      return NextResponse.json({
        history: [],
        count: 0,
        hasMore: false,
        range: {
          from: null,
          to: null,
        },
      }, {
        headers: { "Cache-Control": "no-store" },
      })
    }

    let query = `
      SELECT s.*, d.vehicle as driverVehicle 
      FROM schedules s 
      LEFT JOIN drivers d ON s.driver = d.name
    `
    const conditions = [...baseConditions]
    const params = [...baseParams]

    if (effectiveDateFrom) {
      conditions.push(`${paidAtJakartaDateExpr} >= ?`)
      params.push(effectiveDateFrom)
    }

    if (effectiveDateTo) {
      conditions.push(`${paidAtJakartaDateExpr} <= ?`)
      params.push(effectiveDateTo)
    }

    query += ` WHERE ${conditions.join(" AND ")}`
    query += ` ORDER BY ${paidAtExpr} DESC, s.id DESC`

    if (limit) {
      query += ` LIMIT ${limit}`
    }

    const [rows] = await pool.execute(query, params)

    const history = (rows as Array<Record<string, unknown>>).map(row => ({
      ...row,
      vehicle: row.vehicle || row.driverVehicle || null,
    }))

    let hasMore = false
    if (effectiveDateFrom) {
      const olderConditions = [...baseConditions, `${paidAtJakartaDateExpr} < ?`]
      const olderParams = [...baseParams, effectiveDateFrom]

      if (lowerBound) {
        olderConditions.push(`${paidAtJakartaDateExpr} >= ?`)
        olderParams.push(lowerBound)
      }

      const [olderRows] = await pool.execute(
        `SELECT 1 FROM schedules s WHERE ${olderConditions.join(" AND ")} LIMIT 1`,
        olderParams
      ) as any
      hasMore = olderRows.length > 0
    }

    const responseData = {
      history,
      count: history.length,
      hasMore,
      range: {
        from: effectiveDateFrom,
        to: effectiveDateTo,
      },
    }

    return NextResponse.json(responseData, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("DB Error:", error)
    return NextResponse.json({ error: `Database error: ${error}` }, { status: 500 })
  }
}
