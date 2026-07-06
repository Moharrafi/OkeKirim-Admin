import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

import { dashboardCache, CACHE_TTL } from "@/lib/dashboard-cache"

function addOneMonth(dateString: string) {
  const [year, month] = dateString.split("-").map(Number)
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
}

function parseMonthStart(monthValue: string | null) {
  if (!monthValue) return null

  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(monthValue)
  if (!match) return null

  const month = Number(match[2])
  if (month < 1 || month > 12) return null

  return `${match[1]}-${match[2]}-01`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const driverFilter = searchParams.get("driver")
  const requestedDriverDepositMonthStart = parseMonthStart(searchParams.get("driverDepositMonth"))
  const cacheKey = `dashboard_${driverFilter || "all"}_${requestedDriverDepositMonthStart || "auto"}`

  // Return cached data if still fresh
  const cached = dashboardCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  try {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
    const todayStr = now.toISOString().split("T")[0]

    const jakartaDate = new Date(now.getTime() + 7 * 60 * 60 * 1000)
    const jakartaTodayStr = jakartaDate.toISOString().split("T")[0]

    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`

    const driverWhere = driverFilter ? " AND driver LIKE ?" : ""
    const scheduleDriverWhere = driverFilter ? " AND s.driver LIKE ?" : ""
    const driverParam = driverFilter ? [`%${driverFilter}%`] : []

    const currentDay = now.getDate()
    const lastMonthSamePeriodEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, currentDay)
    const lastMonthSamePeriodEndStr = `${lastMonthSamePeriodEnd.getFullYear()}-${String(lastMonthSamePeriodEnd.getMonth() + 1).padStart(2, "0")}-${String(lastMonthSamePeriodEnd.getDate()).padStart(2, "0")}`

    const threeDaysAgo = new Date(now)
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const threeDaysAgoStr = `${threeDaysAgo.getFullYear()}-${String(threeDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(threeDaysAgo.getDate()).padStart(2, "0")}`

    // Run independent queries in parallel using Promise.all
    const [
      [monthlyRows],
      [lastMonthRows],
      [pendingRows],
      [todayRows],
      [driverRows],
      [debtRows],
      [recentRows],
      [monthlyChart],
      [overdueRows],
      [latestMonthRows]
    ] = await Promise.all([
      pool.execute(
        `SELECT COALESCE(SUM(companyShare), 0) as totalCompany, COALESCE(SUM(fare), 0) as totalFare, COUNT(*) as count FROM schedules WHERE date >= ?${driverWhere}`,
        [monthStart, ...driverParam]
      ),
      pool.execute(
        `SELECT COALESCE(SUM(companyShare), 0) as totalCompany, COALESCE(SUM(fare), 0) as totalFare FROM schedules WHERE date >= ? AND date <= ?${driverWhere}`,
        [lastMonthStart, lastMonthSamePeriodEndStr, ...driverParam]
      ),
      pool.execute(
        `SELECT COALESCE(SUM(companyShare - paidCompanyAmount), 0) as total, COUNT(*) as count FROM schedules WHERE status = 'nunggak'${driverWhere}`,
        [...driverParam]
      ),
      pool.execute(
        `SELECT COALESCE(SUM(lastPaidAmount), 0) as total, COUNT(*) as count 
         FROM schedules 
         WHERE DATE(DATE_ADD(lastPaidAt, INTERVAL 7 HOUR)) = ?${driverWhere}`,
        [jakartaTodayStr, ...driverParam]
      ),
      pool.execute(
        "SELECT COUNT(*) as count FROM drivers WHERE status = 'aktif'"
      ),
      pool.execute(
        `SELECT COALESCE(SUM(amount - paidAmount), 0) as totalDebt, COUNT(*) as count FROM debts WHERE status = 'belum_lunas'${driverWhere}`,
        [...driverParam]
      ),
      pool.execute(
        `SELECT s.*, d.vehicle as driverVehicle 
         FROM schedules s 
         LEFT JOIN drivers d ON s.driver = d.name
         ${driverFilter ? "WHERE s.driver LIKE ?" : ""}
         ORDER BY s.id DESC LIMIT 5`,
        driverFilter ? [`%${driverFilter}%`] : []
      ),
      pool.execute(
        `SELECT MONTH(date) as month, 
                CAST(SUM(companyShare) AS UNSIGNED) as total,
                CAST(SUM(fare) AS UNSIGNED) as totalFare,
                COUNT(*) as tripCount
         FROM schedules 
         WHERE YEAR(date) = ?${driverWhere}
         GROUP BY MONTH(date) 
         ORDER BY month`,
        [now.getFullYear(), ...driverParam]
      ),
      pool.execute(
        `SELECT COUNT(*) as count FROM schedules WHERE status = 'nunggak' AND date < ?${driverWhere}`,
        [threeDaysAgoStr, ...driverParam]
      ),
      pool.execute(
        `SELECT DATE_FORMAT(MAX(date), '%Y-%m-01') as monthStart FROM schedules WHERE date IS NOT NULL${driverWhere}`,
        [...driverParam]
      )
    ]) as any[]

    const currentMonthCount = Number((monthlyRows as any[])[0]?.count || 0)
    const pendingDebtTotal = Number((debtRows as any[])[0]?.totalDebt || 0)
    const pendingDebtCount = Number((debtRows as any[])[0]?.count || 0)

    let driverChartMonthStart = monthStart
    if (currentMonthCount === 0) {
      const latestMonthStart = latestMonthRows?.[0]?.monthStart
      if (typeof latestMonthStart === "string" && latestMonthStart) {
        driverChartMonthStart = latestMonthStart
      }
    }
    const driverChartMonthEnd = addOneMonth(driverChartMonthStart)

    const driverDepositMonthStart = requestedDriverDepositMonthStart || driverChartMonthStart
    const driverDepositMonthEnd = addOneMonth(driverDepositMonthStart)

    // Run dependent queries in parallel
    const [
      [driverIncome],
      [driverDepositByMonth],
      [orderTypeBreakdown]
    ] = await Promise.all([
      pool.execute(
        `SELECT s.driver, CAST(SUM(s.companyShare) AS UNSIGNED) as total, COUNT(*) as trips
         FROM schedules s 
         WHERE s.date >= ? AND s.date < ?
         GROUP BY s.driver 
         ORDER BY total DESC`,
        [driverChartMonthStart, driverChartMonthEnd]
      ),
      pool.execute(
        `SELECT s.driver,
                CAST(COALESCE(SUM(s.fare), 0) AS UNSIGNED) as totalFare,
                CAST(COALESCE(SUM(s.companyShare), 0) AS UNSIGNED) as total,
                CAST(COALESCE(SUM(GREATEST(CAST(COALESCE(s.fare, 0) AS SIGNED) - CAST(COALESCE(s.companyShare, 0) AS SIGNED), 0)), 0) AS UNSIGNED) as driverShare,
                CAST(COALESCE(SUM(COALESCE(s.paidCompanyAmount, 0)), 0) AS UNSIGNED) as paid,
                CAST(COALESCE(SUM(GREATEST(CAST(COALESCE(s.companyShare, 0) AS SIGNED) - CAST(COALESCE(s.paidCompanyAmount, 0) AS SIGNED), 0)), 0) AS UNSIGNED) as remaining,
                COUNT(*) as trips
         FROM schedules s
         WHERE s.date >= ? AND s.date < ?${scheduleDriverWhere}
         GROUP BY s.driver
         ORDER BY total DESC, paid DESC`,
        [driverDepositMonthStart, driverDepositMonthEnd, ...driverParam]
      ),
      pool.execute(
        `SELECT orderType, CAST(SUM(fare) AS UNSIGNED) as total, COUNT(*) as count
         FROM schedules 
         WHERE date >= ? AND date < ?${driverWhere}
         GROUP BY orderType`,
        [driverChartMonthStart, driverChartMonthEnd, ...driverParam]
      )
    ]) as any[]

    const chartData = (monthlyChart as Array<{ month: number; total: string | number; totalFare: string | number; tripCount: string | number }>).map(r => ({
      month: Number(r.month),
      total: Number(r.total),
      totalFare: Number(r.totalFare || 0),
      tripCount: Number(r.tripCount || 0),
    }))

    const driverData = (driverIncome as Array<{ driver: string; total: string | number; trips: string | number }>).map(r => ({
      driver: String(r.driver).trim(),
      total: Number(r.total),
      trips: Number(r.trips || 0),
    }))

    const driverDepositData = (driverDepositByMonth as Array<{ driver: string; totalFare: string | number; total: string | number; driverShare: string | number; paid: string | number; remaining: string | number; trips: string | number }>).map(r => ({
      driver: String(r.driver).trim(),
      totalFare: Number(r.totalFare || 0),
      total: Number(r.total || 0),
      driverShare: Number(r.driverShare || 0),
      paid: Number(r.paid || 0),
      remaining: Number(r.remaining || 0),
      trips: Number(r.trips || 0),
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
      pendingDebtTotal,
      pendingDebtCount,
      todayTotal: Number((todayRows as any[])[0]?.total || 0),
      todayCount: Number((todayRows as any[])[0]?.count || 0),
      activeDrivers: Number((driverRows as any[])[0]?.count || 0),
      overdueCount: Number((overdueRows as any[])[0]?.count || 0),
      driverChartMonth: driverChartMonthStart,
      driverDepositMonth: driverDepositMonthStart,
      recentTransactions: recentRows,
      monthlyChart: chartData,
      driverIncome: driverData,
      driverDepositByMonth: driverDepositData,
      orderTypeBreakdown: (orderTypeBreakdown as Array<{ orderType: string; total: string | number; count: string | number }>).map(r => ({
        type: r.orderType === "offline" ? "Offline" : "Online",
        total: Number(r.total),
        count: Number(r.count),
      })),
    }

    // Update cache
    dashboardCache.set(cacheKey, { data: responseData, timestamp: Date.now() })

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Dashboard error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
