import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    { error: "GPS admin notification cron is disabled" },
    { status: 410 }
  )
}
