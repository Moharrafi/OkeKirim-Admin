import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const driverName = searchParams.get("driver") || searchParams.get("name")

  if (!driverName) {
    return NextResponse.json({ error: "Parameter driver atau name wajib diisi" }, { status: 400 })
  }

  try {
    // 1. Get driver info from DB
    const [driverRows] = await pool.execute(
      "SELECT id, name, vehicle, vehicleType, status FROM drivers WHERE name = ? LIMIT 1",
      [driverName]
    ) as any[]

    const driverInfo = driverRows[0] || { name: driverName, vehicle: null, vehicleType: null, status: "tidak_terdaftar" }

    // 2. Deposit statistics (from schedules)
    const [depositStats] = await pool.execute(
      `SELECT 
        COUNT(*) as tripCount,
        COALESCE(SUM(fare), 0) as totalFare,
        COALESCE(SUM(companyShare), 0) as totalCompanyShare,
        COALESCE(SUM(paidCompanyAmount), 0) as totalPaidDeposit,
        SUM(CASE WHEN status = 'nunggak' THEN 1 ELSE 0 END) as pendingTripCount
       FROM schedules WHERE driver = ?`,
      [driverName]
    ) as any[]

    const stats = depositStats[0] || { tripCount: 0, totalFare: 0, totalCompanyShare: 0, totalPaidDeposit: 0, pendingTripCount: 0 }
    const totalRemainingDeposit = Math.max(0, Number(stats.totalCompanyShare) - Number(stats.totalPaidDeposit))

    // Unpaid schedules list
    const [unpaidSchedules] = await pool.execute(
      "SELECT id, date, origin, destination, fare, companyShare, paidCompanyAmount, status FROM schedules WHERE driver = ? AND status = 'nunggak' ORDER BY date DESC, id DESC",
      [driverName]
    ) as any[]

    // Recent paid schedules list (limit 10 for context)
    const [recentPaidSchedules] = await pool.execute(
      "SELECT id, date, origin, destination, fare, companyShare, paidCompanyAmount, status FROM schedules WHERE driver = ? AND status = 'lunas' ORDER BY date DESC, id DESC LIMIT 10",
      [driverName]
    ) as any[]

    // 3. Debt statistics (from debts)
    const [debtStats] = await pool.execute(
      `SELECT 
        COUNT(*) as debtCount,
        COALESCE(SUM(amount), 0) as totalDebt,
        COALESCE(SUM(paidAmount), 0) as totalPaidDebt
       FROM debts WHERE driver = ?`,
      [driverName]
    ) as any[]

    const dStats = debtStats[0] || { debtCount: 0, totalDebt: 0, totalPaidDebt: 0 }
    const totalRemainingDebt = Math.max(0, Number(dStats.totalDebt) - Number(dStats.totalPaidDebt))

    // All debts list
    const [debtsList] = await pool.execute(
      "SELECT id, date, dueDate, amount, paidAmount, status, notes FROM debts WHERE driver = ? ORDER BY date DESC, id DESC",
      [driverName]
    ) as any[]

    // Debt payments list
    const [debtPayments] = await pool.execute(
      "SELECT id, debt_id, amount, paid_at, notes FROM debt_payments WHERE driver = ? ORDER BY paid_at DESC, id DESC",
      [driverName]
    ) as any[]

    return NextResponse.json({
      driver: driverInfo,
      deposits: {
        summary: {
          tripCount: Number(stats.tripCount),
          totalFare: Number(stats.totalFare),
          totalCompanyShare: Number(stats.totalCompanyShare),
          totalPaid: Number(stats.totalPaidDeposit),
          totalRemaining: Number(totalRemainingDeposit),
          pendingTripCount: Number(stats.pendingTripCount)
        },
        unpaid: unpaidSchedules,
        recentPaid: recentPaidSchedules
      },
      debts: {
        summary: {
          debtCount: Number(dStats.debtCount),
          totalDebt: Number(dStats.totalDebt),
          totalPaid: Number(dStats.totalPaidDebt),
          totalRemaining: Number(totalRemainingDebt)
        },
        list: debtsList,
        payments: debtPayments
      }
    }, {
      headers: { "Cache-Control": "no-store" }
    })
  } catch (error) {
    console.error("Driver report error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
