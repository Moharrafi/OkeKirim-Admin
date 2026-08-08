import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { ensureNotificationsTable } from "@/lib/notifications-schema"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    await ensureNotificationsTable()

    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role") || "admin"
    const driverName = searchParams.get("driver") || ""
    const requestedLimit = Number(searchParams.get("limit") || 50)
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100)
      : 50
    const requestedOffset = Number(searchParams.get("offset") || 0)
    const offset = Number.isFinite(requestedOffset)
      ? Math.max(Math.trunc(requestedOffset), 0)
      : 0
    const unreadOnly = searchParams.get("unread") === "true"

    let whereClause = ""
    const params: any[] = []

    if (role === "admin") {
      whereClause = "WHERE target_role = 'admin' OR target_role LIKE 'admin:%'"
    } else if (driverName) {
      const driverLower = driverName.trim().toLowerCase()
      whereClause = `WHERE (
        (target_role = 'driver' AND (
          data IS NULL 
          OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.driver')) IS NULL 
          OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(data, '$.driver'))) = ?
        ))
        OR LOWER(target_role) = ?
      )`
      params.push(driverLower, `driver:${driverLower}`)
    } else {
      whereClause = "WHERE target_role = 'driver'"
    }

    if (unreadOnly) {
      whereClause += " AND is_read = 0"
    }

    const query = `
      SELECT
        id,
        target_role,
        title,
        body,
        type,
        data,
        is_read,
        DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS created_at
      FROM notifications
      ${whereClause}
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `

    const [rows] = await pool.execute(query, params) as any

    // Get unread count with same scoped filter
    const countQuery = `SELECT COUNT(*) as count FROM notifications ${whereClause} AND is_read = 0`
    const [countRows] = await pool.execute(countQuery, params) as any

    return NextResponse.json({
      notifications: rows || [],
      unreadCount: countRows?.[0]?.count || 0,
      hasMore: (rows || []).length === limit,
      nextOffset: offset + (rows || []).length,
    })
  } catch (error) {
    console.error("Notifications GET error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureNotificationsTable()

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
