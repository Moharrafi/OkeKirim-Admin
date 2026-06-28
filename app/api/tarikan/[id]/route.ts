import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { isRateLimited, rateLimitedResponse, getClientIp } from "@/lib/api-auth"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(request)
  if (isRateLimited(ip, 20, 60000)) return rateLimitedResponse()

  const { id } = await params
  const scheduleId = parseInt(id)
  if (!scheduleId) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { driver, vehicle, date, origin, destination, rit, orderType, fare, notes, orderProof } = body

    const companyShare = Math.round((fare || 0) * 0.4)

    const hasOrderProof = orderProof !== undefined
    const query = hasOrderProof
      ? `UPDATE schedules SET driver=?, vehicle=?, date=?, origin=?, destination=?, rit=?, orderType=?, fare=?, companyShare=?, notes=?, orderProof=? WHERE id=?`
      : `UPDATE schedules SET driver=?, vehicle=?, date=?, origin=?, destination=?, rit=?, orderType=?, fare=?, companyShare=?, notes=? WHERE id=?`

    const params = [
      driver || null,
      vehicle || null,
      date || null,
      origin || null,
      destination || null,
      rit || null,
      orderType || "online",
      fare || 0,
      companyShare,
      notes || null,
    ]
    if (hasOrderProof) {
      params.push(orderProof || null)
    }
    params.push(scheduleId)

    await pool.execute(query, params)

    // Clear dashboard cache since stats have changed
    try {
      const { clearDashboardCache } = await import("@/app/api/dashboard/route")
      clearDashboardCache()
    } catch (e) {
      console.warn("Failed to clear dashboard cache:", e)
    }

    return NextResponse.json({ success: true, id: scheduleId })
  } catch (error) {
    console.error("Update error:", error)
    return NextResponse.json({ error: `Database error: ${error}` }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(request)
  if (isRateLimited(ip, 10, 60000)) return rateLimitedResponse()

  const { id } = await params
  const scheduleId = parseInt(id)
  if (!scheduleId) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 })
  }

  try {
    await pool.execute("DELETE FROM schedules WHERE id = ?", [scheduleId])

    // Clear dashboard cache since stats have changed
    try {
      const { clearDashboardCache } = await import("@/app/api/dashboard/route")
      clearDashboardCache()
    } catch (e) {
      console.warn("Failed to clear dashboard cache:", e)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json({ error: `Database error: ${error}` }, { status: 500 })
  }
}
