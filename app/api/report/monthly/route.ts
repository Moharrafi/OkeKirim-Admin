import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || ""

function formatRupiah(n: number): string {
  return n.toLocaleString("id-ID")
}

export async function POST(request: NextRequest) {
  // Optional: verify secret key for cron
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")
  if (key && key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get current or previous month
    const body = await request.json().catch(() => ({})) as { month?: number; year?: number }
    const now = new Date()
    const month = body.month || now.getMonth() + 1
    const year = body.year || now.getFullYear()
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
    const monthEnd = `${year}-${String(month).padStart(2, "0")}-31`

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    const monthName = monthNames[month - 1]

    // Total argo & company share
    const [totalRows] = await pool.execute(
      "SELECT COALESCE(SUM(fare), 0) as totalFare, COALESCE(SUM(companyShare), 0) as totalCompany, COUNT(*) as tripCount FROM schedules WHERE date >= ? AND date <= ?",
      [monthStart, monthEnd]
    ) as any

    // Lunas vs nunggak
    const [statusRows] = await pool.execute(
      "SELECT status, COUNT(*) as count, COALESCE(SUM(companyShare - paidCompanyAmount), 0) as sisaTotal FROM schedules WHERE date >= ? AND date <= ? GROUP BY status",
      [monthStart, monthEnd]
    ) as any

    // Service costs this month
    const [serviceRows] = await pool.execute(
      "SELECT COALESCE(SUM(cost), 0) as totalService, COUNT(*) as serviceCount FROM services WHERE date >= ? AND date <= ?",
      [monthStart, monthEnd]
    ) as any

    // Per driver breakdown
    const [driverRows] = await pool.execute(
      `SELECT driver, 
              COUNT(*) as trips, 
              COALESCE(SUM(companyShare), 0) as totalCompany,
              COALESCE(SUM(companyShare - paidCompanyAmount), 0) as sisa,
              SUM(CASE WHEN status = 'nunggak' THEN 1 ELSE 0 END) as nunggakCount
       FROM schedules 
       WHERE date >= ? AND date <= ?
       GROUP BY driver 
       ORDER BY totalCompany DESC`,
      [monthStart, monthEnd]
    ) as any

    const totalFare = Number(totalRows[0]?.totalFare || 0)
    const totalCompany = Number(totalRows[0]?.totalCompany || 0)
    const tripCount = Number(totalRows[0]?.tripCount || 0)
    const totalService = Number(serviceRows[0]?.totalService || 0)
    const serviceCount = Number(serviceRows[0]?.serviceCount || 0)
    const labaBersih = totalCompany - totalService

    const lunasCount = statusRows.find((r: any) => r.status === "lunas")?.count || 0
    const nunggakCount = statusRows.find((r: any) => r.status === "nunggak")?.count || 0
    const totalSisaNunggak = statusRows.find((r: any) => r.status === "nunggak")?.sisaTotal || 0

    // Build Telegram message
    // Pad driver names to align
    const maxNameLen = Math.max(...driverRows.map((d: any) => String(d.driver).trim().length), 6)
    let driverList = ""
    for (const d of driverRows) {
      const sisa = Number(d.sisa)
      const emoji = sisa > 0 ? "⚠️" : "✅"
      const name = String(d.driver).trim().padEnd(maxNameLen, " ")
      driverList += `${emoji} ${name} : ${sisa > 0 ? `Rp ${formatRupiah(sisa)} (${d.nunggakCount} nunggak)` : "Lunas semua"}\n`
    }

    const message = `📊 <b>LAPORAN BULANAN - ${monthName.toUpperCase()} ${year}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 <b>Pendapatan</b>\n` +
      `<code>` +
      `Total Argo      : Rp ${formatRupiah(totalFare)}\n` +
      `Perusahaan      : Rp ${formatRupiah(totalCompany)}\n` +
      `Biaya Service   : Rp ${formatRupiah(totalService)} (${serviceCount}x)\n` +
      `─────────────────────────\n` +
      `Laba Bersih     : Rp ${formatRupiah(labaBersih)}` +
      `</code>\n\n` +
      `📋 <b>Trip:</b> ${tripCount} total (${lunasCount} lunas, ${nunggakCount} nunggak)\n` +
      (Number(totalSisaNunggak) > 0 ? `⚠️ <b>Total Nunggak:</b> Rp ${formatRupiah(Number(totalSisaNunggak))}\n` : "") +
      `\n` +
      `👤 <b>Per Driver:</b>\n` +
      `<code>` + driverList + `</code>\n` +
      `\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<code>OkeMitra • Laporan Otomatis</code>`

    // Send to Telegram
    const telegramRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    })

    const telegramResult = await telegramRes.json()

    return NextResponse.json({
      success: telegramResult.ok,
      data: {
        month: monthName,
        year,
        totalFare,
        totalCompany,
        totalService,
        labaBersih,
        tripCount,
        lunasCount,
        nunggakCount,
      },
    })
  } catch (error) {
    console.error("Monthly report error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// GET handler for Vercel Cron (runs on 1st of each month)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")
  
  // For cron: report previous month
  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  // Reuse POST logic
  const fakeRequest = new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ month: prevMonth, year: prevYear }),
  })

  return POST(fakeRequest as unknown as NextRequest)
}
