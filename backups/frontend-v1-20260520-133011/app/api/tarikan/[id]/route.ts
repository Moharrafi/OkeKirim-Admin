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
    const { driver, vehicle, date, origin, destination, rit, orderType, fare, notes } = body

    const companyShare = Math.round((fare || 0) * 0.4)

    await pool.execute(
      `UPDATE schedules SET driver=?, vehicle=?, date=?, origin=?, destination=?, rit=?, orderType=?, fare=?, companyShare=?, notes=? WHERE id=?`,
      [
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
        scheduleId,
      ]
    )

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
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json({ error: `Database error: ${error}` }, { status: 500 })
  }
}
