import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

// Simple in-memory cache for dashboard data (TTL: 30 seconds)
let cache: { data: unknown; timestamp: number; key: string } | null = null
const CACHE_TTL = 30_000 // 30 seconds

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const driverFilter = searchParams.get("driver")
  const cacheKey = `dashboard_${driverFilter || "all"}`

  // Return cached data if still fresh
  if (cache && cache.key === cacheKey && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
    const todayStr = now.toISOString().split("T")[0]

    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`

    const driverWhere = driverFilter ? " AND driver LIKE ?" : ""
    const driverParam = driverFilter ? [`%${driverFilter}%`] : []

    const currentDay = now.getDate()
    const lastMonthSamePeriodEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, currentDay)
    const lastMonthSamePeriodEndStr = `${lastMonthSamePeriodEnd.getFullYear()}-${String(lastMonthSamePeriodEnd.getMonth() + 1).padStart(2, "0")}-${String(lastMonthSamePeriodEnd.getDate()).padStart(2, "0")}`

    // Run queries sequentially (single connection to respect Aiven free tier limit)
    const [monthlyRows] = await pool.execute(
      `SELECT COALESCE(SUM(companyShare), 0) as totalCompany, COALESCE(SUM(fare), 0) as totalFare, COUNT(*) as count FROM schedules WHERE date >= ?${driverWhere}`,
      [monthStart, ...driverParam]
    ) as any

    const [lastMonthRows] = await pool.execute(
      `SELECT COALESCE(SUM(companyShare), 0) as totalCompany, COALESCE(SUM(fare), 0) as totalFare FROM schedules WHERE date >= ? AND date <= ?${driverWhere}`,
      [lastMonthStart, lastMonthSamePeriodEndStr, ...driverParam]
    ) as any

    const [pendingRows] = await pool.execute(
      `SELECT COALESCE(SUM(companyShare - paidCompanyAmount), 0) as total, COUNT(*) as count FROM schedules WHERE status = 'nunggak'${driverWhere}`,
      [...driverParam]
    ) as any

    const [todayRows] = await pool.execute(
      `SELECT COALESCE(SUM(companyShare), 0) as total, COUNT(*) as count FROM schedules WHERE date = ?${driverWhere}`,
      [todayStr, ...driverParam]
    ) as any

    const [driverRows] = await pool.execute(
      "SELECT COUNT(*) as count FROM drivers WHERE status = 'aktif'"
    ) as any

    const [recentRows] = await pool.execute(
      `SELECT s.*, d.vehicle as driverVehicle 
       FROM schedules s 
       LEFT JOIN drivers d ON LOWER(TRIM(s.driver)) = LOWER(TRIM(d.name))
       ${driverFilter ? "WHERE s.driver LIKE ?" : ""}
       ORDER BY s.id DESC LIMIT 5`,
      driverFilter ? [`%${driverFilter}%`] : []
    ) as any

    const [monthlyChart] = await pool.execute(
      `SELECT MONTH(date) as month, CAST(SUM(companyShare) AS UNSIGNED) as total 
       FROM schedules 
       WHERE YEAR(date) = ?${driverWhere}
       GROUP BY MONTH(date) 
       ORDER BY month`,
      [now.getFullYear(), ...driverParam]
    ) as any

    const [driverIncome] = driverFilter
      ? [[] as Array<{ driver: string; total: string | number }>]
      : await pool.execute(
          `SELECT s.driver, CAST(SUM(s.companyShare) AS UNSIGNED) as total 
           FROM schedules s 
           WHERE s.date >= ?
           GROUP BY s.driver 
           ORDER BY total DESC 
           LIMIT 5`,
          [monthStart]
        ).then(([rows]: any) => [rows]) as any

    const [orderTypeBreakdown] = await pool.execute(
      `SELECT orderType, CAST(SUM(fare) AS UNSIGNED) as total, COUNT(*) as count
       FROM schedules 
       WHERE date >= ?${driverWhere}
       GROUP BY orderType`,
      [monthStart, ...driverParam]
    ) as any

    const chartData = (monthlyChart as Array<{ month: number; total: string | number }>).map(r => ({
      month: Number(r.month),
      total: Number(r.total),
    }))

    const driverData = (driverIncome as Array<{ driver: string; total: string | number }>).map(r => ({
      driver: String(r.driver).trim(),
      total: Number(r.total),
    }))

    const monthlyCompany = Number((monthlyRows as any[])[0]?.totalCompany || 0)
    const monthlyFare = Number((monthlyRows as any[])[0]?.totalFare || 0)
    const lastMonthCompany = Number((lastMonthRows as any[])[0]?.totalCompany || 0)
    const lastMonthFare = Number((lastMonthRows as any[])[0]?.totalFare || 0)

    const responseData = {
      monthlyCompanyShare: monthlyCompany,
      monthlyDriverShare: monthlyFare - monthlyCompany,
      monthlyFare: monthlyFare,
      monthlyCount: Number((monthlyRows as any[])[0]?.count || 0),
      lastMonthCompanyShare: lastMonthCompany,
      lastMonthDriverShare: lastMonthFare - lastMonthCompany,
      lastMonthFare: lastMonthFare,
      pendingTotal: Number((pendingRows as any[])[0]?.total || 0),
      pendingCount: Number((pendingRows as any[])[0]?.count || 0),
      todayTotal: Number((todayRows as any[])[0]?.total || 0),
      todayCount: Number((todayRows as any[])[0]?.count || 0),
      activeDrivers: Number((driverRows as any[])[0]?.count || 0),
      recentTransactions: recentRows,
      monthlyChart: chartData,
      driverIncome: driverData,
      orderTypeBreakdown: (orderTypeBreakdown as Array<{ orderType: string; total: string | number; count: string | number }>).map(r => ({
        type: r.orderType === "offline" ? "Offline" : "Online",
        total: Number(r.total),
        count: Number(r.count),
      })),
    }

    // Update cache
    cache = { data: responseData, timestamp: Date.now(), key: cacheKey }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Dashboard error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
