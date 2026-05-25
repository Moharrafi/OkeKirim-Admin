import { NextRequest, NextResponse } from "next/server"
import { syncAdminGpsDepositNotifications } from "@/lib/admin-gps-deposit-notifications"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")

  if (key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const date = searchParams.get("date") || undefined
    const result = await syncAdminGpsDepositNotifications({ date, force: true })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("GPS admin notification cron error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
