import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role") || "admin"
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100)
    const unreadOnly = searchParams.get("unread") === "true"

    let query = `SELECT * FROM notifications WHERE target_role = ?`
    const params: any[] = [role]

    if (unreadOnly) {
      query += ` AND is_read = 0`
    }

    query += ` ORDER BY created_at DESC LIMIT ?`
    params.push(limit)

    const [rows] = await pool.execute(query, params) as any

    // Get unread count
    const [countRows] = await pool.execute(
      "SELECT COUNT(*) as count FROM notifications WHERE target_role = ? AND is_read = 0",
      [role]
    ) as any

    return NextResponse.json({
      notifications: rows || [],
      unreadCount: countRows?.[0]?.count || 0,
    })
  } catch (error) {
    console.error("Notifications GET error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, markAll, role } = body

    if (markAll && role) {
      // Mark all as read for a role
      await pool.execute(
        "UPDATE notifications SET is_read = 1 WHERE target_role = ? AND is_read = 0",
        [role]
      )
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      // Mark specific notifications as read
      const placeholders = ids.map(() => "?").join(",")
      await pool.execute(
        `UPDATE notifications SET is_read = 1 WHERE id IN (${placeholders})`,
        ids
      )
    } else {
      return NextResponse.json({ error: "ids array or markAll+role required" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Notifications PATCH error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
