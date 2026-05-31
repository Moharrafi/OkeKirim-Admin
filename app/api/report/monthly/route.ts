import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || ""
const SEPARATOR = "-".repeat(32)
const ICON_REPORT = "\u{1F4CA}"
const ICON_MONEY = "\u{1F4B0}"
const ICON_TRIP = "\u{1F4CB}"
const ICON_DRIVER = "\u{1F464}"
const ICON_WARNING = "\u26A0\uFE0F"
const ICON_OK = "\u2705"

type TotalRow = {
  totalFare: string | number
  totalCompany: string | number
  tripCount: string | number
}

type StatusRow = {
  status: string
  count: string | number
  sisaTotal: string | number
}

type ServiceRow = {
  totalService: string | number
  serviceCount: string | number
}

type DriverRow = {
  driver: string
  trips: string | number
  totalCompany: string | number
  sisa: string | number
  nunggakCount: string | number
}

function formatRupiah(n: number): string {
  return n.toLocaleString("id-ID")
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function getNextMonthStart(year: number, month: number): string {
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
}

function resolveReportMonth(body: { month?: number; year?: number }) {
  const now = new Date()
  const requestedMonth = Number(body.month)
  const requestedYear = Number(body.year)

  const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
    ? requestedMonth
    : now.getMonth() + 1
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000
    ? requestedYear
    : now.getFullYear()

  return { month, year }
}

function buildDriverList(driverRows: DriverRow[]): string {
  const maxNameLen = Math.max(...driverRows.map((d) => String(d.driver).trim().length), 6)

  return driverRows.map((d) => {
    const sisa = Number(d.sisa)
    const statusIcon = sisa > 0 ? ICON_WARNING : ICON_OK
    const name = escapeHtml(String(d.driver).trim().padEnd(maxNameLen, " "))
    const statusText = sisa > 0
      ? `Rp ${formatRupiah(sisa)} (${d.nunggakCount} nunggak)`
      : "Lunas semua"

    return `${statusIcon} ${name} : ${statusText}`
  }).join("\n")
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")
  if (key && key !== process.env.CRON_SECRET && key !== "manual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({})) as { month?: number; year?: number }
    const { month, year } = resolveReportMonth(body)
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
    const nextMonthStart = getNextMonthStart(year, month)

    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ]
    const monthName = monthNames[month - 1]

    const [totalRows] = await pool.execute(
      "SELECT COALESCE(SUM(fare), 0) as totalFare, COALESCE(SUM(companyShare), 0) as totalCompany, COUNT(*) as tripCount FROM schedules WHERE date >= ? AND date < ?",
      [monthStart, nextMonthStart]
    ) as [TotalRow[], unknown]

    const [statusRows] = await pool.execute(
      "SELECT status, COUNT(*) as count, COALESCE(SUM(companyShare - paidCompanyAmount), 0) as sisaTotal FROM schedules WHERE date >= ? AND date < ? GROUP BY status",
      [monthStart, nextMonthStart]
    ) as [StatusRow[], unknown]

    const [serviceRows] = await pool.execute(
      "SELECT COALESCE(SUM(cost), 0) as totalService, COUNT(*) as serviceCount FROM services WHERE date >= ? AND date < ?",
      [monthStart, nextMonthStart]
    ) as [ServiceRow[], unknown]

    const [driverRows] = await pool.execute(
      `SELECT driver,
              COUNT(*) as trips,
              COALESCE(SUM(companyShare), 0) as totalCompany,
              COALESCE(SUM(companyShare - paidCompanyAmount), 0) as sisa,
              SUM(CASE WHEN status = 'nunggak' THEN 1 ELSE 0 END) as nunggakCount
       FROM schedules
       WHERE date >= ? AND date < ?
       GROUP BY driver
       ORDER BY totalCompany DESC`,
      [monthStart, nextMonthStart]
    ) as [DriverRow[], unknown]

    const totalFare = Number(totalRows[0]?.totalFare || 0)
    const totalCompany = Number(totalRows[0]?.totalCompany || 0)
    const tripCount = Number(totalRows[0]?.tripCount || 0)
    const totalService = Number(serviceRows[0]?.totalService || 0)
    const serviceCount = Number(serviceRows[0]?.serviceCount || 0)
    const labaBersih = totalCompany - totalService

    const lunasCount = Number(statusRows.find((r) => r.status === "lunas")?.count || 0)
    const nunggakCount = Number(statusRows.find((r) => r.status === "nunggak")?.count || 0)
    const totalSisaNunggak = Number(statusRows.find((r) => r.status === "nunggak")?.sisaTotal || 0)
    const driverList = buildDriverList(driverRows)

    const message = `${ICON_REPORT} <b>LAPORAN BULANAN - ${monthName.toUpperCase()} ${year}</b>\n` +
      `${SEPARATOR}\n\n` +
      `${ICON_MONEY} <b>Pendapatan</b>\n` +
      `<code>` +
      `Total Argo      : Rp ${formatRupiah(totalFare)}\n` +
      `Perusahaan      : Rp ${formatRupiah(totalCompany)}\n` +
      `Biaya Service   : Rp ${formatRupiah(totalService)} (${serviceCount}x)\n` +
      `${SEPARATOR}\n` +
      `Laba Bersih     : Rp ${formatRupiah(labaBersih)}` +
      `</code>\n\n` +
      `${ICON_TRIP} <b>Trip:</b> ${tripCount} total (${lunasCount} lunas, ${nunggakCount} nunggak)\n` +
      (totalSisaNunggak > 0 ? `${ICON_WARNING} <b>Total Nunggak:</b> Rp ${formatRupiah(totalSisaNunggak)}\n` : "") +
      `\n` +
      `${ICON_DRIVER} <b>Per Driver:</b>\n` +
      `<code>${driverList || "Belum ada data"}</code>\n` +
      `\n${SEPARATOR}\n` +
      `<code>OkeMitra - Laporan Otomatis</code>`

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

export async function GET(request: NextRequest) {
  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const fakeRequest = new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ month: prevMonth, year: prevYear }),
  })

  return POST(fakeRequest as unknown as NextRequest)
}
