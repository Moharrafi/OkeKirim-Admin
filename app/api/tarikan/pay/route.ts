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

    const explicitAmount = Number(amount)
    const hasExplicitAmount = Number.isFinite(explicitAmount) && explicitAmount > 0
    let appliedAmount = 0

    if (hasExplicitAmount && scheduleIds.length > 1) {
      // Batch partial payment: distribute in the same order sent by the UI.
      // Any shortage remains on the later selected order(s), not silently marked paid.
      let remaining = explicitAmount

      const placeholders = scheduleIds.map(() => "?").join(",")
      const [rows] = await pool.execute(
        `SELECT id, companyShare, paidCompanyAmount FROM schedules WHERE id IN (${placeholders})`,
        scheduleIds
      ) as any
      const scheduleById = new Map<number, { id: number; companyShare: number; paidCompanyAmount: number; sisa: number }>()

      for (const r of rows) {
        const companyShare = Number(r.companyShare || 0)
        const paidCompanyAmount = Number(r.paidCompanyAmount || 0)
        scheduleById.set(Number(r.id), {
          id: Number(r.id),
          companyShare,
          paidCompanyAmount,
          sisa: Math.max(companyShare - paidCompanyAmount, 0),
        })
      }

      const scheduleData = scheduleIds
        .map((id) => scheduleById.get(id))
        .filter((schedule): schedule is { id: number; companyShare: number; paidCompanyAmount: number; sisa: number } => !!schedule)

      for (const schedule of scheduleData) {
        if (remaining <= 0) break
        if (schedule.sisa <= 0) continue

        const payForThis = Math.min(remaining, schedule.sisa)
        const newPaid = schedule.paidCompanyAmount + payForThis
        const isFullyPaid = newPaid >= schedule.companyShare

        await pool.execute(
          `UPDATE schedules SET status = ?, paidCompanyAmount = ?, lastPaidAt = ?, paidOffAt = ?, payment_notes = ?, lastPaidAmount = ? WHERE id = ?`,
          [
            isFullyPaid ? "lunas" : "nunggak",
            newPaid,
            now,
            isFullyPaid ? now : null,
            isFullyPaid ? "Lunas" : `Cicil Rp ${payForThis.toLocaleString("id-ID")}`,
            payForThis,
            schedule.id,
          ]
        )
        appliedAmount += payForThis
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

        const companyShare = Number(rows[0].companyShare || 0)
        const currentPaid = Number(rows[0].paidCompanyAmount || 0)
        const remainingDue = Math.max(companyShare - currentPaid, 0)

        const payAmount = hasExplicitAmount ? Math.min(explicitAmount, remainingDue) : remainingDue
        appliedAmount += Math.max(Number(payAmount || 0), 0)
        const newPaidTotal = currentPaid + payAmount
        const isFullyPaid = newPaidTotal >= companyShare

        await pool.execute(
          `UPDATE schedules SET status = ?, paidCompanyAmount = ?, lastPaidAt = ?, paidOffAt = ?, payment_notes = ?, lastPaidAmount = ? WHERE id = ?`,
          [
            isFullyPaid ? "lunas" : "nunggak",
            newPaidTotal,
            now,
            isFullyPaid ? now : null,
            isFullyPaid
              ? (paymentNotes && paymentNotes.startsWith("Cicil") ? "Lunas" : paymentNotes || "Lunas")
              : (paymentNotes && paymentNotes !== "Lunas" ? paymentNotes : `Cicil Rp ${payAmount.toLocaleString("id-ID")}`),
            payAmount,
            id,
          ]
        )
      }
    }

    // Notify admins about the deposit payment
    try {
      const notifAmount = appliedAmount || (amount ? Number(amount) : 0)
      if (notifAmount > 0) {
        // Get driver name from the first schedule
        const [driverRows] = await pool.execute(
          "SELECT driver FROM schedules WHERE id = ?",
          [scheduleIds[0]]
        ) as any
        const driverName = driverRows?.[0]?.driver || "Driver"

        await notifyDepositPayment(driverName, notifAmount, scheduleIds.length)
      }
    } catch {}

    // Clear dashboard cache since stats have changed
    try {
      const { clearDashboardCache } = await import("@/lib/dashboard-cache")
      clearDashboardCache()
    } catch (e) {
      console.warn("Failed to clear dashboard cache:", e)
    }

    return NextResponse.json({
      success: true,
      updated: scheduleIds.length,
    })
  } catch (error) {
    console.error("Pay error:", error)
    return NextResponse.json({ error: `Database error: ${error}` }, { status: 500 })
  }
}
