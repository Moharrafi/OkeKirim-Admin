import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { notifyNewOrder } from "@/lib/notify-admin"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const filter = searchParams.get("filter") // "pending" | "paid" | "all"
  const driver = searchParams.get("driver")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = (page - 1) * limit

  try {
    let query = `
      SELECT s.*, d.vehicle as driverVehicle 
      FROM schedules s 
      LEFT JOIN drivers d ON s.driver = d.name
    `
    let countQuery = `SELECT COUNT(*) as total FROM schedules s`
    const params: string[] = []
    const countParams: string[] = []
    const conditions: string[] = []

    if (filter === "pending") {
      conditions.push("s.status = 'nunggak'")
    } else if (filter === "paid") {
      conditions.push("s.status = 'lunas'")
    }

    if (driver) {
      conditions.push("s.driver LIKE ?")
      params.push(`%${driver}%`)
      countParams.push(`%${driver}%`)
    }

    if (conditions.length > 0) {
      const whereClause = " WHERE " + conditions.join(" AND ")
      query += whereClause
      countQuery += whereClause
    }

    query += ` ORDER BY s.id DESC LIMIT ${limit} OFFSET ${offset}`

    const [rows] = await pool.execute(query, params)
    const [countRows] = await pool.execute(countQuery, countParams) as any

    const schedules = (rows as Array<Record<string, unknown>>).map(row => ({
      ...row,
      vehicle: row.vehicle || row.driverVehicle || null,
    }))

    const total = countRows[0]?.total || 0
    const responseData = {
      schedules,
      count: schedules.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }

    return NextResponse.json(responseData, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("DB Error:", error)
    return NextResponse.json({ error: `Database error: ${error}` }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { driver, vehicle, date, origin, destination, rit, orderType, fare, notes, orderProof } = body

    if (!driver || !fare) {
      return NextResponse.json({ error: "Driver dan fare wajib diisi" }, { status: 400 })
    }

    const companyShare = Math.round((fare || 0) * 0.4)

    const [result] = await pool.execute(
      `INSERT INTO schedules (driver, vehicle, date, origin, destination, rit, orderType, fare, status, companyShare, paidCompanyAmount, notes, orderProof, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'nunggak', ?, 0, ?, ?, NOW())`,
      [
        driver,
        vehicle || null,
        date || new Date().toISOString().split("T")[0],
        origin || null,
        destination || null,
        rit || null,
        orderType || "online",
        fare,
        companyShare,
        notes || null,
        orderProof || null,
      ]
    )

    const insertId = (result as { insertId: number }).insertId

    // Wait for FCM logging/sending so serverless execution does not end before the push is queued.
    await notifyNewOrder(driver, origin || "", destination || "", fare)

    return NextResponse.json({ success: true, id: insertId }, { status: 201 })
  } catch (error) {
    console.error("DB Error:", error)
    return NextResponse.json({ error: `Database error: ${error}` }, { status: 500 })
  }
}
