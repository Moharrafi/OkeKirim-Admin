import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { isRateLimited, rateLimitedResponse, getClientIp } from "@/lib/api-auth"
import { notifyDepositPayment } from "@/lib/notify-admin"

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (isRateLimited(ip, 10, 60000)) {
    return rateLimitedResponse()
  }

  try {
    const body = await request.json()
    const { ids, paymentNotes, amount } = body

    // Support single id or array of ids (batch)
    const scheduleIds: number[] = Array.isArray(ids) ? ids : [ids]

    if (scheduleIds.length === 0) {
      return NextResponse.json({ error: "ID orderan wajib" }, { status: 400 })
    }

    const now = new Date().toISOString().slice(0, 19).replace("T", " ")

    if (amount && scheduleIds.length > 1) {
      // Batch partial payment: distribute from oldest to newest
      // Oldest gets paid first, newest gets the remainder
      let remaining = Number(amount)
      
      // Get all schedules sorted by date ASC (oldest first)
      const scheduleData: Array<{ id: number; companyShare: number; paidCompanyAmount: number; sisa: number }> = []
      for (const id of scheduleIds) {
        const [rows] = await pool.execute(
          "SELECT id, companyShare, paidCompanyAmount, date FROM schedules WHERE id = ?",
          [id]
        ) as any
        if (rows.length > 0) {
          const r = rows[0]
          scheduleData.push({
            id: r.id,
            companyShare: r.companyShare,
            paidCompanyAmount: r.paidCompanyAmount || 0,
            sisa: r.companyShare - (r.paidCompanyAmount || 0),
          })
        }
      }

      // Pay oldest first
      for (const schedule of scheduleData) {
        if (remaining <= 0) break
        const payForThis = Math.min(remaining, schedule.sisa)
        const newPaid = schedule.paidCompanyAmount + payForThis
        const isFullyPaid = newPaid >= schedule.companyShare

        await pool.execute(
          `UPDATE schedules SET status = ?, paidCompanyAmount = ?, lastPaidAt = ?, paidOffAt = ?, payment_notes = ? WHERE id = ?`,
          [
            isFullyPaid ? "lunas" : "nunggak",
            newPaid,
            now,
            isFullyPaid ? now : null,
            isFullyPaid ? "Lunas" : `Cicil Rp ${payForThis.toLocaleString("id-ID")}`,
            schedule.id,
          ]
        )
        remaining -= payForThis
      }
    } else {
      // Single payment or full batch
      for (const id of scheduleIds) {
        const [rows] = await pool.execute(
          "SELECT companyShare, paidCompanyAmount FROM schedules WHERE id = ?",
          [id]
        ) as any

        if (rows.length === 0) continue

        const companyShare = rows[0].companyShare
        const currentPaid = rows[0].paidCompanyAmount || 0

        const payAmount = amount ? Math.min(Number(amount), companyShare - currentPaid) : (companyShare - currentPaid)
        const newPaidTotal = currentPaid + payAmount
        const isFullyPaid = newPaidTotal >= companyShare

        await pool.execute(
          `UPDATE schedules SET status = ?, paidCompanyAmount = ?, lastPaidAt = ?, paidOffAt = ?, payment_notes = ? WHERE id = ?`,
          [
            isFullyPaid ? "lunas" : "nunggak",
            newPaidTotal,
            now,
            isFullyPaid ? now : null,
            paymentNotes || (isFullyPaid ? "Lunas" : `Cicil Rp ${payAmount.toLocaleString("id-ID")}`),
            id,
          ]
        )
      }
    }

    // Notify admins about the deposit payment
    try {
      // Get driver name from the first schedule
      const [driverRows] = await pool.execute(
        "SELECT driver FROM schedules WHERE id = ?",
        [scheduleIds[0]]
      ) as any
      const driverName = driverRows?.[0]?.driver || "Driver"
      const totalAmount = amount ? Number(amount) : 0

      // Calculate total paid if no explicit amount
      let notifAmount = totalAmount
      if (!notifAmount) {
        const [sumRows] = await pool.execute(
          `SELECT COALESCE(SUM(companyShare), 0) as total FROM schedules WHERE id IN (${scheduleIds.map(() => "?").join(",")})`,
          scheduleIds
        ) as any
        notifAmount = sumRows?.[0]?.total || 0
      }

      await notifyDepositPayment(driverName, notifAmount, scheduleIds.length)
    } catch {}

    return NextResponse.json({
      success: true,
      updated: scheduleIds.length,
    })
  } catch (error) {
    console.error("Pay error:", error)
    return NextResponse.json({ error: `Database error: ${error}` }, { status: 500 })
  }
}
