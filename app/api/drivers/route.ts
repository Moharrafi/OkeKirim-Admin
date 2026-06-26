import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET() {
  try {
    let rows: any[]
    try {
      // Try with password_hash column
      const [result] = await pool.execute(
        "SELECT id, name, phone, email, address, vehicle, vehicleType, vehicleYear, status, joinDate, created_at, CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END AS has_password FROM drivers ORDER BY name ASC"
      )
      rows = result as any[]
    } catch {
      // Fallback if password_hash column doesn't exist yet
      const [result] = await pool.execute(
        "SELECT id, name, phone, email, address, vehicle, vehicleType, vehicleYear, status, joinDate, created_at FROM drivers ORDER BY name ASC"
      )
      rows = (result as any[]).map((r: any) => ({ ...r, has_password: 0 }))
    }
    // Map has_password to password_hash boolean for frontend compatibility
    const drivers = rows.map((r: any) => ({
      ...r,
      password_hash: r.has_password ? true : null,
      has_password: undefined,
    }))

    // Fetch all unique vehicles historically used in schedules and drivers
    let vehicles: string[] = []
    try {
      const [driverVehicles] = await pool.execute(
        "SELECT DISTINCT vehicle FROM drivers WHERE vehicle IS NOT NULL AND vehicle != ''"
      ) as any[]
      
      const [scheduleVehicles] = await pool.execute(
        "SELECT DISTINCT vehicle FROM schedules WHERE vehicle IS NOT NULL AND vehicle != ''"
      ) as any[]

      const allVehiclesSet = new Set<string>()
      driverVehicles.forEach((r: any) => {
        if (r.vehicle) allVehiclesSet.add(r.vehicle.trim().toUpperCase())
      })
      scheduleVehicles.forEach((r: any) => {
        if (r.vehicle) allVehiclesSet.add(r.vehicle.trim().toUpperCase())
      })
      
      vehicles = Array.from(allVehiclesSet)
    } catch (e) {
      console.warn("Failed to fetch historical vehicles list:", e)
      // Fallback to current drivers vehicles
      vehicles = drivers.map((d: any) => d.vehicle ? d.vehicle.trim().toUpperCase() : "").filter(Boolean)
    }

    return NextResponse.json({ drivers, vehicles })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, vehicle, vehicleType, status } = body
    if (!name) return NextResponse.json({ error: "Nama wajib" }, { status: 400 })

    const [result] = await pool.execute(
      "INSERT INTO drivers (name, vehicle, vehicleType, status) VALUES (?, ?, ?, ?)",
      [name, vehicle || null, vehicleType || null, status || "aktif"]
    ) as any

    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, vehicle, vehicleType, status } = body
    if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 })

    await pool.execute(
      "UPDATE drivers SET name=?, vehicle=?, vehicleType=?, status=? WHERE id=?",
      [name, vehicle || null, vehicleType || null, status || "aktif", id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 })

    await pool.execute("DELETE FROM drivers WHERE id=?", [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
