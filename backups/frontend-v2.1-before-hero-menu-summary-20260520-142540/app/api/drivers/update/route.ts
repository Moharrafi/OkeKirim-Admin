import { NextResponse } from "next/server"
import pool from "@/lib/db"

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, phone, email, address } = body

    if (!id) {
      return NextResponse.json({ error: "Driver ID is required" }, { status: 400 })
    }

    const fields: string[] = []
    const values: (string | number)[] = []

    if (name !== undefined) {
      fields.push("name = ?")
      values.push(name)
    }
    if (phone !== undefined) {
      fields.push("phone = ?")
      values.push(phone)
    }
    if (email !== undefined) {
      fields.push("email = ?")
      values.push(email)
    }
    if (address !== undefined) {
      fields.push("address = ?")
      values.push(address)
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    values.push(id)

    const query = `UPDATE drivers SET ${fields.join(", ")} WHERE id = ?`
    const [result] = await pool.execute(query, values)

    return NextResponse.json({ success: true, message: "Driver updated successfully", result })
  } catch (error) {
    console.error("DB Error:", error)
    return NextResponse.json({ error: `Database error: ${error}` }, { status: 500 })
  }
}
