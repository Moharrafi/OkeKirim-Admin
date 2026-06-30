"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TrendingUp,
  Wallet,
  Wrench,
  Smartphone,
  Banknote,
  Users,
  Percent,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  Coins,
  Download,
  AlertTriangle,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import { PullToRefresh } from "@/components/pull-to-refresh"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts"

interface DashboardData {
  monthlyCompanyShare: number
  monthlyDriverShare: number
  monthlyFare: number
  monthlyCount: number
  lastMonthCompanyShare: number
  lastMonthDriverShare: number
  lastMonthFare: number
  pendingTotal: number
  pendingCount: number
  todayTotal: number
  todayCount: number
  activeDrivers: number
  overdueCount: number
  driverChartMonth?: string
  driverDepositMonth?: string
  recentTransactions: Array<{
    id: number
    driver: string
    origin: string
    destination: string
    fare: number
    companyShare: number
    status: string
    orderType: string
    date: string
  }>
  monthlyChart: Array<{ month: number; total: number; totalFare?: number; tripCount?: number }>
  driverIncome: Array<{ driver: string; total: number; trips?: number }>
  driverDepositByMonth: Array<{ driver: string; totalFare?: number; total: number; driverShare?: number; paid: number; remaining: number; trips?: number }>
  orderTypeBreakdown: Array<{ type: string; total: number; count: number }>
}

interface ServiceLog {
  id: number
  vehicle: string
  driver: string
  type: string
  date: string
  cost: number
  status: string
  hasReceipt: number
}

function formatRupiah(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

const monthLabels = [
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

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number)
  const monthName = monthLabels[month - 1]
  if (!year || !monthName) return "Bulan dipilih"
  return `${monthName} ${year}`
}

function shortenDriverName(name: string) {
  return name.length > 13 ? `${name.slice(0, 12)}...` : name
}

const depositMonthSelectOptions = monthLabels.map((label, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label,
}))

type DepositRecapRow = {
  driver: string
  totalFare: number
  total: number
  driverShare: number
  paid: number
  remaining: number
  trips: number
}

type DepositRecapSummary = {
  totalFare: number
  total: number
  driverShare: number
  paid: number
  remaining: number
  trips: number
}

type DepositProfitSummary = {
  totalFare: number
  companyShare: number
  driverShare: number
  paid: number
  remaining: number
  serviceCost: number
  netProfit: number
  cashProfit: number
  trips: number
  completionRate: number
}

function normalizePdfText(value: string | number) {
  return String(value)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function escapePdfText(value: string | number) {
  return normalizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
}

function truncatePdfText(value: string | number, maxLength: number) {
  const text = normalizePdfText(value)
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(maxLength - 3, 1))}...`
}

function pdfByteLength(value: string) {
  return new TextEncoder().encode(value).length
}

function createPdfBlob(pageStreams: string[], width: number, height: number) {
  const objects: string[] = []
  const pageIds: number[] = []

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>"
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"

  pageStreams.forEach((stream) => {
    const contentId = objects.length
    objects[contentId] = `<< /Length ${pdfByteLength(stream)} >>\nstream\n${stream}\nendstream`

    const pageId = objects.length
    pageIds.push(pageId)
    objects[pageId] = [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}]`,
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>`,
      `/Contents ${contentId} 0 R >>`,
    ].join(" ")
  })

  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`

  let pdf = "%PDF-1.4\n"
  const offsets = [0]

  for (let i = 1; i < objects.length; i++) {
    offsets[i] = pdfByteLength(pdf)
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`
  }

  const xrefOffset = pdfByteLength(pdf)
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`

  for (let i = 1; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new Blob([pdf], { type: "application/pdf" })
}

function createDepositRecapPdf(
  rows: DepositRecapRow[],
  summary: DepositRecapSummary,
  profit: DepositProfitSummary,
  periodLabel: string,
  generatedAt: string
) {
  const width = 841.89
  const height = 595.28
  const margin = 36
  const contentWidth = width - margin * 2
  const pages: string[][] = []
  let ops: string[] = []

  const COLOR_BG: [number, number, number] = [0.975, 0.98, 0.985]
  const COLOR_PRIMARY: [number, number, number] = [0.047, 0.165, 0.114]
  const COLOR_PRIMARY_SUB: [number, number, number] = [0.68, 0.85, 0.77]
  const COLOR_TEXT_DARK: [number, number, number] = [0.12, 0.16, 0.14]
  const COLOR_TEXT_MUTED: [number, number, number] = [0.45, 0.5, 0.47]
  const COLOR_BORDER: [number, number, number] = [0.88, 0.9, 0.89]

  const color = (rgb: [number, number, number]) => rgb.map((item) => item.toFixed(3)).join(" ")
  const pdfY = (top: number, itemHeight = 0) => height - top - itemHeight

  const addPage = () => {
    ops = []
    pages.push(ops)
    ops.push(`q ${color(COLOR_BG)} rg 0 0 ${width} ${height} re f Q`)
  }

  const rect = (
    x: number,
    top: number,
    rectWidth: number,
    rectHeight: number,
    fill: [number, number, number],
    stroke?: [number, number, number]
  ) => {
    const strokePart = stroke ? `${color(stroke)} RG 0.6 w ` : ""
    ops.push(`q ${color(fill)} rg ${strokePart}${x} ${pdfY(top, rectHeight)} ${rectWidth} ${rectHeight} re ${stroke ? "B" : "f"} Q`)
  }

  const line = (x1: number, y1: number, x2: number, y2: number, stroke: [number, number, number]) => {
    ops.push(`q ${color(stroke)} RG 0.6 w ${x1} ${pdfY(y1)} m ${x2} ${pdfY(y2)} l S Q`)
  }

  const estimateTextWidth = (value: string, size: number, font: "F1" | "F2") => {
    return value.length * size * (font === "F2" ? 0.56 : 0.52)
  }

  const text = (
    x: number,
    top: number,
    value: string | number,
    options?: {
      size?: number
      font?: "F1" | "F2"
      fill?: [number, number, number]
      align?: "left" | "right" | "center"
    }
  ) => {
    const size = options?.size || 10
    const font = options?.font || "F1"
    const fill = options?.fill || COLOR_TEXT_DARK
    const raw = normalizePdfText(value)
    const escaped = escapePdfText(raw)
    const estimatedWidth = estimateTextWidth(raw, size, font)
    let startX = x

    if (options?.align === "right") {
      startX = x - estimatedWidth
    } else if (options?.align === "center") {
      startX = x - estimatedWidth / 2
    }

    ops.push(`q ${color(fill)} rg BT /${font} ${size} Tf ${startX.toFixed(2)} ${pdfY(top + size)} Td (${escaped}) Tj ET Q`)
  }

  const drawFirstPageHeader = () => {
    const badgeWidth = 96
    const badgeX = width - margin - badgeWidth - 24

    rect(margin, 28, contentWidth, 74, COLOR_PRIMARY)
    text(margin + 24, 46, "Laporan Profit & Setoran Driver", { size: 22, font: "F2", fill: [1, 1, 1] })
    text(margin + 24, 76, `Periode ${periodLabel} | Dibuat ${generatedAt}`, { size: 10, fill: COLOR_PRIMARY_SUB })
    rect(badgeX, 51, badgeWidth, 28, [0.1, 0.32, 0.22])
    text(badgeX + badgeWidth / 2, 60, "LAPORAN PDF", { size: 9, font: "F2", fill: [0.85, 0.98, 0.91], align: "center" })
  }

  const drawSmallHeader = () => {
    rect(margin, 28, contentWidth, 38, COLOR_PRIMARY)
    text(margin + 16, 40, "Laporan Profit & Setoran Driver", { size: 13, font: "F2", fill: [1, 1, 1] })
    text(width - margin - 16, 42, periodLabel, { size: 9.5, fill: COLOR_PRIMARY_SUB, align: "right" })
  }

  const drawProfitSummary = () => {
    const isNetPositive = profit.netProfit >= 0
    const heroFill: [number, number, number] = isNetPositive ? [0.063, 0.22, 0.15] : [0.42, 0.08, 0.08]
    const heroSubFill: [number, number, number] = isNetPositive ? [0.65, 0.9, 0.78] : [0.9, 0.65, 0.65]
    const heroAccent: [number, number, number] = isNetPositive ? [0.1, 0.8, 0.45] : [0.9, 0.2, 0.2]
    const panelX = margin + 322
    const panelWidth = contentWidth - 322
    const miniGap = 8
    const miniWidth = (panelWidth - 30 - miniGap * 2) / 3
    const completionBarWidth = 196
    const completionRight = width - margin - 24

    const drawMiniMetric = (
      index: number,
      label: string,
      value: string,
      fill: [number, number, number],
      accent: [number, number, number]
    ) => {
      const column = index % 3
      const row = Math.floor(index / 3)
      const x = panelX + 15 + column * (miniWidth + miniGap)
      const top = 166 + row * 41

      rect(x, top, miniWidth, 32, fill, COLOR_BORDER)
      rect(x, top, 4, 32, accent)
      text(x + 10, top + 6, label, { size: 7.4, font: "F2", fill: COLOR_TEXT_MUTED })
      text(x + 10, top + 18, value, { size: 9.4, font: "F2", fill: COLOR_TEXT_DARK })
    }

    text(margin, 116, "Ringkasan Profit Perusahaan", { size: 12.5, font: "F2", fill: COLOR_PRIMARY })
    text(width - margin, 117, `Periode ${periodLabel}`, { size: 9.2, fill: COLOR_TEXT_MUTED, align: "right" })

    rect(margin, 136, 302, 112, heroFill)
    rect(margin, 136, 4, 112, heroAccent)
    text(margin + 24, 154, "LABA BERSIH", { size: 9.2, font: "F2", fill: heroSubFill })
    text(margin + 24, 179, `Rp ${formatRupiah(profit.netProfit)}`, { size: 24, font: "F2", fill: [1, 1, 1] })
    text(margin + 24, 207, "Wajib Setor - Biaya Servis", { size: 8.8, fill: heroSubFill })
    rect(margin + 24, 218, 258, 1, heroSubFill)
    text(margin + 24, 226, `Laba Kas Masuk: Rp ${formatRupiah(profit.cashProfit)}`, { size: 10.2, font: "F2", fill: [1, 1, 1] })

    rect(panelX, 136, panelWidth, 112, [1, 1, 1], COLOR_BORDER)
    text(panelX + 15, 150, "Komponen Bulanan", { size: 10.4, font: "F2", fill: COLOR_PRIMARY })
    text(width - margin - 16, 150, `${profit.trips} trip`, { size: 9, font: "F2", fill: COLOR_TEXT_MUTED, align: "right" })

    drawMiniMetric(0, "Total Argo", `Rp ${formatRupiah(profit.totalFare)}`, [0.95, 0.97, 0.99], [0.17, 0.42, 0.69])
    drawMiniMetric(1, "Wajib Setor", `Rp ${formatRupiah(profit.companyShare)}`, [0.95, 0.985, 0.965], [0.05, 0.35, 0.22])
    drawMiniMetric(2, "Setoran Masuk", `Rp ${formatRupiah(profit.paid)}`, [0.94, 0.985, 0.96], [0.08, 0.5, 0.3])
    drawMiniMetric(3, "Pendapatan Driver", `Rp ${formatRupiah(profit.driverShare)}`, [0.995, 0.98, 0.95], [0.72, 0.36, 0.08])
    drawMiniMetric(4, "Biaya Servis", `Rp ${formatRupiah(profit.serviceCost)}`, [0.995, 0.965, 0.965], [0.76, 0.2, 0.18])
    drawMiniMetric(5, "Sisa Setoran", `Rp ${formatRupiah(profit.remaining)}`, [0.995, 0.975, 0.95], [0.74, 0.4, 0.04])

    rect(margin, 264, contentWidth, 52, [0.96, 0.985, 0.97], COLOR_BORDER)
    rect(margin, 264, 3, 52, COLOR_PRIMARY)
    text(margin + 16, 278, "Detail Perhitungan", { size: 9.6, font: "F2", fill: COLOR_PRIMARY })
    text(margin + 16, 296, `Laba Bersih = Rp ${formatRupiah(profit.companyShare)} - Rp ${formatRupiah(profit.serviceCost)} = Rp ${formatRupiah(profit.netProfit)}`, { size: 8.8, fill: [0.28, 0.34, 0.31] })

    text(completionRight - completionBarWidth, 278, "Realisasi Setoran", { size: 9.4, font: "F2", fill: COLOR_PRIMARY })
    text(completionRight, 278, `${profit.completionRate}%`, { size: 10.6, font: "F2", fill: [0.02, 0.42, 0.22], align: "right" })
    rect(completionRight - completionBarWidth, 292, completionBarWidth, 6, [0.9, 0.92, 0.91])
    rect(completionRight - completionBarWidth, 292, completionBarWidth * (profit.completionRate / 100), 6, [0.1, 0.7, 0.45])
    text(completionRight, 306, `Masuk Rp ${formatRupiah(profit.paid)} dari Rp ${formatRupiah(profit.companyShare)}`, { size: 7.8, fill: COLOR_TEXT_MUTED, align: "right" })
  }

  const columns = [
    { label: "No", width: 34, align: "center" as const },
    { label: "Driver", width: 170, align: "left" as const },
    { label: "Trip", width: 44, align: "right" as const },
    { label: "Total Argo", width: 116, align: "right" as const },
    { label: "Wajib Setor", width: 116, align: "right" as const },
    { label: "Masuk", width: 116, align: "right" as const },
    { label: "Sisa", width: 116, align: "right" as const },
    { label: "Masuk %", width: 57, align: "right" as const },
  ]

  const drawTableHeader = (top: number) => {
    let x = margin
    rect(margin, top, contentWidth, 24, [0.043, 0.145, 0.102])

    columns.forEach((column) => {
      const labelX = column.align === "right" ? x + column.width - 8 : column.align === "center" ? x + column.width / 2 : x + 8
      text(labelX, top + 8, column.label, { size: 8.5, font: "F2", fill: [1, 1, 1], align: column.align })
      x += column.width
    })

    return top + 24
  }

  const drawTableRow = (top: number, values: Array<string | number>, rowIndex: number, isTotal = false) => {
    const rowHeight = isTotal ? 28 : 24
    const fill = isTotal
      ? [0.91, 0.95, 0.93] as [number, number, number]
      : rowIndex % 2 === 0
        ? [1, 1, 1] as [number, number, number]
        : [0.965, 0.975, 0.97] as [number, number, number]

    rect(margin, top, contentWidth, rowHeight, fill, COLOR_BORDER)

    let x = margin
    values.forEach((value, index) => {
      const column = columns[index]
      const labelX = column.align === "right" ? x + column.width - 8 : column.align === "center" ? x + column.width / 2 : x + 8
      const display = index === 1 ? truncatePdfText(value, isTotal ? 12 : 30) : value
      text(labelX, top + 8, display, {
        size: isTotal ? 9.2 : 8.5,
        font: isTotal ? "F2" : "F1",
        fill: COLOR_TEXT_DARK,
        align: column.align,
      })
      x += column.width
    })

    return top + rowHeight
  }

  addPage()
  drawFirstPageHeader()
  drawProfitSummary()

  let rowTop = drawTableHeader(336)

  rows.forEach((driver, index) => {
    if (rowTop + 24 > height - 52) {
      addPage()
      drawSmallHeader()
      rowTop = drawTableHeader(86)
    }

    const completion = driver.total > 0 ? Math.min(Math.round((driver.paid / driver.total) * 100), 100) : 0
    rowTop = drawTableRow(rowTop, [
      index + 1,
      driver.driver,
      driver.trips,
      `Rp ${formatRupiah(driver.totalFare)}`,
      `Rp ${formatRupiah(driver.total)}`,
      `Rp ${formatRupiah(driver.paid)}`,
      `Rp ${formatRupiah(driver.remaining)}`,
      `${completion}%`,
    ], index)
  })

  if (rowTop + 28 > height - 52) {
    addPage()
    drawSmallHeader()
    rowTop = drawTableHeader(86)
  }

  const totalCompletion = summary.total > 0 ? Math.min(Math.round((summary.paid / summary.total) * 100), 100) : 0
  drawTableRow(rowTop, [
    "Total",
    "",
    summary.trips,
    `Rp ${formatRupiah(summary.totalFare)}`,
    `Rp ${formatRupiah(summary.total)}`,
    `Rp ${formatRupiah(summary.paid)}`,
    `Rp ${formatRupiah(summary.remaining)}`,
    `${totalCompletion}%`,
  ], rows.length, true)

  pages.forEach((pageOps, index) => {
    ops = pageOps
    line(margin, height - 34, width - margin, height - 34, COLOR_BORDER)
    text(margin, height - 24, "OkeKirim - Laporan profit & setoran driver", { size: 8.5, fill: COLOR_TEXT_MUTED })
    text(width - margin, height - 24, `Halaman ${index + 1} dari ${pages.length}`, { size: 8.5, fill: COLOR_TEXT_MUTED, align: "right" })
  })

  return createPdfBlob(pages.map((page) => page.join("\n")), width, height)
}

export default function AnalysisPage() {
  const router = useRouter()
  const { isAdmin, user, isAuthenticated } = useUser()
  const [data, setData] = useState<DashboardData | null>(null)
  const [services, setServices] = useState<ServiceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"trends" | "shares" | "orders" | "admin">("trends")
  const [selectedDepositMonth, setSelectedDepositMonth] = useState("")

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  const fetchData = useCallback(async (depositMonth?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (!isAdmin && user.name) {
        params.set("driver", user.name)
      }
      if (depositMonth) {
        params.set("driverDepositMonth", depositMonth)
      }

      // Fetch dashboard data
      const dashRes = await fetch(`/api/dashboard?${params.toString()}`)
      const dashData = await dashRes.json()
      
      if (!dashRes.ok || dashData.error) {
        setError(dashData.error || "Gagal memuat data analisis")
        setData(null)
        return
      }

      setData(dashData)
      if (!depositMonth && typeof dashData.driverDepositMonth === "string") {
        setSelectedDepositMonth(dashData.driverDepositMonth.slice(0, 7))
      }

      // Fetch service logs if admin (for laba bersih calculations)
      if (isAdmin) {
        const servRes = await fetch("/api/services")
        const servData = await servRes.json()
        if (!servRes.ok || servData.error) {
          console.warn("Failed to fetch service logs:", servData.error)
        } else {
          setServices(servData.services || [])
        }
      }
    } catch (err) {
      console.error("Failed to fetch analysis data:", err)
      setError(String(err))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, user.name])

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [fetchData, isAuthenticated])

  // Total service cost calculation (current month vs last month)
  const serviceStats = useMemo(() => {
    if (!isAdmin || services.length === 0) return { currentMonth: 0, lastMonth: 0 }
    
    const now = new Date()
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`

    let currentMonthTotal = 0
    let lastMonthTotal = 0

    services.forEach(s => {
      if (!s.date) return
      if (s.date.startsWith(currentMonthStr)) {
        currentMonthTotal += Number(s.cost || 0)
      } else if (s.date.startsWith(lastMonthStr)) {
        lastMonthTotal += Number(s.cost || 0)
      }
    })

    return {
      currentMonth: currentMonthTotal,
      lastMonth: lastMonthTotal
    }
  }, [isAdmin, services])

  // Financial calculations
  const finances = useMemo(() => {
    if (!data) return null

    const companyShare = data.monthlyCompanyShare || 0
    const driverShare = data.monthlyDriverShare || 0
    const argoTotal = data.monthlyFare || 0
    
    const prevCompanyShare = data.lastMonthCompanyShare || 0
    const prevDriverShare = data.lastMonthDriverShare || 0
    const prevArgoTotal = data.lastMonthFare || 0

    // Admin profit = Company Share - Service Costs
    const netProfit = companyShare - (isAdmin ? serviceStats.currentMonth : 0)
    const prevNetProfit = prevCompanyShare - (isAdmin ? serviceStats.lastMonth : 0)

    // Growth percentages
    const calcGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0
      return Math.round(((curr - prev) / prev) * 100)
    }

    return {
      companyShare,
      driverShare,
      argoTotal,
      netProfit,
      prevCompanyShare,
      prevDriverShare,
      prevArgoTotal,
      prevNetProfit,
      companyGrowth: calcGrowth(companyShare, prevCompanyShare),
      driverGrowth: calcGrowth(driverShare, prevDriverShare),
      argoGrowth: calcGrowth(argoTotal, prevArgoTotal),
      netProfitGrowth: calcGrowth(netProfit, prevNetProfit)
    }
  }, [data, isAdmin, serviceStats])

  // AI Financial Insights calculation
  const aiInsights = useMemo(() => {
    if (!finances || !data) return []

    const insights = []
    
    // 1. Profitability Insight
    const netProfitGrowth = finances.netProfitGrowth || 0
    if (netProfitGrowth > 10) {
      insights.push({
        type: "success",
        title: "Pertumbuhan Profit Positif",
        desc: `Bagi hasil perusahaan tumbuh sebesar ${netProfitGrowth.toFixed(1)}% MoM. Kinerja operasional sangat sehat.`
      })
    } else if (netProfitGrowth < 0) {
      insights.push({
        type: "danger",
        title: "Penurunan Profit Operasional",
        desc: `Bagi hasil perusahaan mengalami penurunan sebesar ${Math.abs(netProfitGrowth).toFixed(1)}% MoM. Evaluasi kembali utilitas armada.`
      })
    } else {
      insights.push({
        type: "info",
        title: "Kondisi Finansial Stabil",
        desc: "Pembagian hasil dan total profit operasional berjalan stabil MoM. Pertahankan ritme trip saat ini."
      })
    }

    // 2. Service Cost Efficiency
    if (isAdmin && services.length > 0) {
      const currentMonthCost = serviceStats.currentMonth || 0
      const companyShare = finances.companyShare || 0
      const ratio = companyShare > 0 ? (currentMonthCost / companyShare) * 100 : 0
      
      if (ratio > 35) {
        insights.push({
          type: "warning",
          title: "Beban Servis Truk Tinggi",
          desc: `Biaya servis bulan ini (Rp ${formatRupiah(currentMonthCost)}) memakan ${ratio.toFixed(1)}% dari bagi hasil. Disarankan audit suku cadang.`
        })
      } else if (currentMonthCost > 0) {
        insights.push({
          type: "success",
          title: "Efisiensi Servis Terjaga",
          desc: `Biaya servis bulan ini terkontrol dengan baik (hanya ${ratio.toFixed(1)}% dari pendapatan). Perawatan preventif armada efektif.`
        })
      }
    }

    // 3. Deposit Overdue
    const overdue = data.overdueCount || 0
    if (overdue > 0) {
      insights.push({
        type: "warning",
        title: "Setoran Tertunda Terdeteksi",
        desc: `Ada ${overdue} orderan yang jatuh tempo (overdue > 7 hari) belum disetor. Segera kirim pengingat WA otomatis ke driver.`
      })
    } else {
      insights.push({
        type: "success",
        title: "Kepatuhan Setoran 100%",
        desc: "Seluruh setoran driver terdistribusi tepat waktu. Tidak ada orderan nunggak melebihi batas 7 hari."
      })
    }

    return insights
  }, [finances, data, services, serviceStats.currentMonth, isAdmin])

  // Monthly trends chart data
  const monthlyChartData = useMemo(() => {
    if (!data || !Array.isArray(data.monthlyChart)) return []
    return data.monthlyChart.map(d => {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
      const monthName = monthNames[d.month - 1]
      
      const companyShareVal = d.total || 0
      const totalFareVal = d.totalFare || (companyShareVal * 2.5)
      const driverShareVal = totalFareVal - companyShareVal
      const tripCountVal = d.tripCount || 0
      const avgFareVal = tripCountVal > 0 ? Math.round(totalFareVal / tripCountVal) : 0

      return {
        month: monthName,
        monthNum: d.month,
        companyShare: companyShareVal,
        driverShare: driverShareVal,
        totalFare: totalFareVal,
        tripCount: tripCountVal,
        avgFare: avgFareVal,
        "Bagi Hasil": companyShareVal / 1000000,
        "Pendapatan Driver": driverShareVal / 1000000,
        "Total Argo": totalFareVal / 1000000,
      }
    })
  }, [data])

  const selectedDepositMonthNumber = selectedDepositMonth
    ? selectedDepositMonth.slice(5, 7)
    : String(new Date().getMonth() + 1).padStart(2, "0")
  const selectedDepositYear = selectedDepositMonth
    ? selectedDepositMonth.slice(0, 4)
    : String(new Date().getFullYear())

  const depositYearOptions = useMemo(() => {
    const nowYear = new Date().getFullYear()
    const years = new Set<string>()

    for (let i = 0; i < 6; i++) {
      years.add(String(nowYear - i))
    }

    if (selectedDepositYear) {
      years.add(selectedDepositYear)
    }

    return Array.from(years).sort((a, b) => Number(b) - Number(a))
  }, [selectedDepositYear])

  const driverDepositRows = useMemo(() => {
    if (!data) return []

    const rows = data.driverDepositByMonth || data.driverIncome || []
    if (!Array.isArray(rows)) return []
    return rows.map((row) => {
      const total = Number(row.total || 0)
      const totalFare = "totalFare" in row && row.totalFare
        ? Number(row.totalFare || 0)
        : Math.round(total / 0.4)
      const driverShare = "driverShare" in row && row.driverShare
        ? Number(row.driverShare || 0)
        : Math.max(totalFare - total, 0)
      const paid = "paid" in row ? Number(row.paid || 0) : 0
      const remaining = "remaining" in row ? Number(row.remaining || 0) : Math.max(total - paid, 0)

      return {
        driver: row.driver,
        totalFare,
        total,
        driverShare,
        paid,
        remaining,
        trips: Number(row.trips || 0),
      }
    })
  }, [data])

  const driverDepositSummary = useMemo(() => {
    return driverDepositRows.reduce(
      (summary, row) => ({
        totalFare: summary.totalFare + row.totalFare,
        total: summary.total + row.total,
        driverShare: summary.driverShare + row.driverShare,
        paid: summary.paid + row.paid,
        remaining: summary.remaining + row.remaining,
        trips: summary.trips + row.trips,
      }),
      { totalFare: 0, total: 0, driverShare: 0, paid: 0, remaining: 0, trips: 0 }
    )
  }, [driverDepositRows])

  const driverDepositChartHeight = Math.max(220, driverDepositRows.length * 42)
  const selectedDepositMonthLabel = selectedDepositMonth ? formatMonthLabel(selectedDepositMonth) : "Bulan dipilih"
  const selectedDepositServiceCost = useMemo(() => {
    if (!isAdmin || !selectedDepositMonth) return 0

    return services.reduce((total, service) => {
      if (!service.date?.startsWith(selectedDepositMonth)) return total
      return total + Number(service.cost || 0)
    }, 0)
  }, [isAdmin, selectedDepositMonth, services])

  const depositProfitSummary = useMemo(() => {
    const completionRate = driverDepositSummary.total > 0
      ? Math.min(Math.round((driverDepositSummary.paid / driverDepositSummary.total) * 100), 100)
      : 0

    return {
      totalFare: driverDepositSummary.totalFare,
      companyShare: driverDepositSummary.total,
      driverShare: driverDepositSummary.driverShare,
      paid: driverDepositSummary.paid,
      remaining: driverDepositSummary.remaining,
      serviceCost: selectedDepositServiceCost,
      netProfit: driverDepositSummary.total - selectedDepositServiceCost,
      cashProfit: driverDepositSummary.paid - selectedDepositServiceCost,
      trips: driverDepositSummary.trips,
      completionRate,
    }
  }, [driverDepositSummary, selectedDepositServiceCost])

  const completedMonthsData = useMemo(() => {
    const currentMonthNum = new Date().getMonth() + 1
    return monthlyChartData.filter(d => d.monthNum !== currentMonthNum)
  }, [monthlyChartData])

  const bestMonth = useMemo(() => {
    if (completedMonthsData.length === 0) return null
    return [...completedMonthsData].sort((a, b) => b.totalFare - a.totalFare)[0]
  }, [completedMonthsData])

  const worstMonth = useMemo(() => {
    if (completedMonthsData.length === 0) return null
    const positiveMonths = completedMonthsData.filter(d => d.totalFare > 0)
    const list = positiveMonths.length > 0 ? positiveMonths : completedMonthsData
    return [...list].sort((a, b) => a.totalFare - b.totalFare)[0]
  }, [completedMonthsData])

  const tabs = useMemo(() => {
    const list = [
      { id: "trends", label: "Perkembangan" },
      { id: "shares", label: "Keuntungan" },
      { id: "orders", label: "Tipe Order" },
    ]
    if (isAdmin) {
      list.push({ id: "admin", label: "Ops & Driver" })
    }
    return list
  }, [isAdmin])

  const activeIndex = useMemo(() => {
    const idx = tabs.findIndex(t => t.id === activeTab)
    return idx >= 0 ? idx : 0
  }, [tabs, activeTab])

  // Order breakdown chart data
  const orderTypeData = useMemo(() => {
    if (!data || !Array.isArray(data.orderTypeBreakdown)) return []
    return data.orderTypeBreakdown.map((ot, idx) => ({
      name: ot.type,
      value: ot.total,
      count: ot.count,
      color: idx === 0 ? "var(--primary)" : "oklch(0.65 0.18 85)",
    }))
  }, [data])

  const totalOrderTypeFare = useMemo(() => {
    return orderTypeData.reduce((s, x) => s + x.value, 0)
  }, [orderTypeData])

  const handleRefresh = async () => {
    await fetchData(selectedDepositMonth || undefined)
  }

  const handleDepositMonthChange = async (month: string) => {
    const nextMonth = `${selectedDepositYear}-${month}`
    setSelectedDepositMonth(nextMonth)
    await fetchData(nextMonth)
  }

  const handleDepositYearChange = async (year: string) => {
    const nextMonth = `${year}-${selectedDepositMonthNumber}`
    setSelectedDepositMonth(nextMonth)
    await fetchData(nextMonth)
  }

  const handleDownloadDepositRecap = useCallback(() => {
    if (driverDepositRows.length === 0) return

    const generatedAt = new Date().toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

    const blob = createDepositRecapPdf(
      driverDepositRows,
      driverDepositSummary,
      depositProfitSummary,
      selectedDepositMonthLabel,
      generatedAt
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `rekap-setoran-driver-${selectedDepositMonth || "bulan"}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [depositProfitSummary, driverDepositRows, driverDepositSummary, selectedDepositMonth, selectedDepositMonthLabel])

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title="Analisis Performa" showBack onBack={() => router.push("/")} />
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-4">
          <div className="p-3 bg-destructive/15 text-destructive rounded-full">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Gagal Memuat Analisis</h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
          <Button onClick={() => fetchData(selectedDepositMonth || undefined)} className="h-10 rounded-xl">
            Coba Lagi
          </Button>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !data || !finances) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title="Analisis Performa" showBack onBack={() => router.push("/")} />
        <div className="flex flex-col items-center justify-center py-24">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-3" />
          <p className="text-sm text-muted-foreground">Memuat data analisis...</p>
        </div>
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen pb-28">
        <MobileHeader title="Analisis Performa" showBack onBack={() => router.push("/")} />

        <main className="px-4 py-4 space-y-4">
          
          {/* Main Financial Summary Cards */}
          <div className="space-y-3">
            {isAdmin ? (
              <>
                {/* Hero Card: Laba Bersih Perusahaan */}
                <Card className={cn(
                  "border shadow-sm p-4 relative overflow-hidden rounded-2xl",
                  finances.netProfit >= 0 
                    ? "border-success/20 bg-gradient-to-br from-success/8 dark:from-success/15 via-card to-card" 
                    : "border-destructive/20 bg-gradient-to-br from-destructive/8 dark:from-destructive/15 via-card to-card"
                )}>
                  <CardContent className="p-0 space-y-4 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("p-2 rounded-xl shrink-0", finances.netProfit >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Laba Bersih Perusahaan</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Bagi hasil bersih dikurangi servis</p>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] font-semibold px-2 py-0.5", finances.netProfitGrowth >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                        {finances.netProfitGrowth >= 0 ? "+" : ""}{finances.netProfitGrowth}% MoM
                      </Badge>
                    </div>
                    <div className="flex items-baseline mt-2">
                      <span className="text-sm font-semibold text-muted-foreground mr-1.5">Rp</span>
                      <span className="text-2xl font-extrabold text-foreground tracking-tight">
                        {formatRupiah(finances.netProfit)}
                      </span>
                    </div>
                  </CardContent>
                  <TrendingUp className={cn(
                    "absolute -right-3 -bottom-3 h-24 w-24 stroke-[1] pointer-events-none opacity-10 dark:opacity-15",
                    finances.netProfit >= 0 ? "text-success" : "text-destructive"
                  )} />
                </Card>

                {/* Sub-metrics row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="border-l-[3px] border-l-primary border border-y-border border-r-border bg-card shadow-sm p-3 rounded-r-xl rounded-l-sm relative overflow-hidden flex flex-col justify-between min-h-[76px]">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Total Argo</p>
                      <p className="text-[11px] font-extrabold text-foreground mt-1 truncate">
                        Rp {formatRupiah(finances.argoTotal)}
                      </p>
                    </div>
                    <span className={cn("text-[8px] font-bold mt-1.5 block", finances.argoGrowth >= 0 ? "text-success" : "text-destructive")}>
                      {finances.argoGrowth >= 0 ? "+" : ""}{finances.argoGrowth}% MoM
                    </span>
                  </div>

                  <div className="border-l-[3px] border-l-blue-500 border border-y-border border-r-border bg-card shadow-sm p-3 rounded-r-xl rounded-l-sm relative overflow-hidden flex flex-col justify-between min-h-[76px]">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Wajib Setor</p>
                      <p className="text-[11px] font-extrabold text-foreground mt-1 truncate">
                        Rp {formatRupiah(finances.companyShare)}
                      </p>
                    </div>
                    <span className={cn("text-[8px] font-bold mt-1.5 block", finances.companyGrowth >= 0 ? "text-success" : "text-destructive")}>
                      {finances.companyGrowth >= 0 ? "+" : ""}{finances.companyGrowth}% MoM
                    </span>
                  </div>

                  <div className="border-l-[3px] border-l-amber-500 border border-y-border border-r-border bg-card shadow-sm p-3 rounded-r-xl rounded-l-sm relative overflow-hidden flex flex-col justify-between min-h-[76px]">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Biaya Servis</p>
                      <p className="text-[11px] font-extrabold text-foreground mt-1 truncate">
                        Rp {formatRupiah(serviceStats.currentMonth)}
                      </p>
                    </div>
                    <span className="text-[8px] font-medium text-muted-foreground mt-1.5 block truncate">
                      {serviceStats.lastMonth > 0 ? `Lalu: Rp ${formatRupiah(serviceStats.lastMonth)}` : "-"}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Hero Card: Pendapatan Bersih Driver */}
                <Card className="border border-primary/20 bg-gradient-to-br from-primary/8 dark:from-primary/15 via-card to-card shadow-sm p-4 relative overflow-hidden rounded-2xl">
                  <CardContent className="p-0 space-y-4 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                          <Wallet className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Pendapatan Bersih</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Porsi pendapatan driver (60%)</p>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] font-semibold px-2 py-0.5", finances.driverGrowth >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                        {finances.driverGrowth >= 0 ? "+" : ""}{finances.driverGrowth}% MoM
                      </Badge>
                    </div>
                    <div className="flex items-baseline mt-2">
                      <span className="text-sm font-semibold text-muted-foreground mr-1.5">Rp</span>
                      <span className="text-2xl font-extrabold text-foreground tracking-tight">
                        {formatRupiah(finances.driverShare)}
                      </span>
                    </div>
                  </CardContent>
                  <Wallet className="absolute -right-3 -bottom-3 h-24 w-24 text-primary/5 dark:text-primary/10 stroke-[1] pointer-events-none" />
                </Card>

                {/* Sub-metrics row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border-l-[3px] border-l-primary border border-y-border border-r-border bg-card shadow-sm p-3 rounded-r-xl rounded-l-sm relative overflow-hidden flex flex-col justify-between min-h-[76px]">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Total Argo</p>
                      <p className="text-xs font-extrabold text-foreground mt-1 truncate">
                        Rp {formatRupiah(finances.argoTotal)}
                      </p>
                    </div>
                    <span className={cn("text-[8px] font-bold mt-1.5 block", finances.argoGrowth >= 0 ? "text-success" : "text-destructive")}>
                      {finances.argoGrowth >= 0 ? "+" : ""}{finances.argoGrowth}% MoM
                    </span>
                  </div>

                  <div className="border-l-[3px] border-l-indigo-500 border border-y-border border-r-border bg-card shadow-sm p-3 rounded-r-xl rounded-l-sm relative overflow-hidden flex flex-col justify-between min-h-[76px]">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Volume Trip</p>
                      <p className="text-xs font-extrabold text-foreground mt-1">
                        {data.monthlyCount} Trip
                      </p>
                    </div>
                    <span className="text-[8px] font-medium text-muted-foreground mt-1.5 block">
                      Bulan berjalan
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="relative flex gap-1 bg-secondary/40 dark:bg-secondary/25 p-1 rounded-xl border border-border/80 overflow-hidden">
            {/* Sliding Active Tab Background */}
            <div
              className="absolute top-1 bottom-1 bg-primary/10 dark:bg-primary/20 rounded-lg transition-all duration-300 ease-out pointer-events-none"
              style={{
                left: `calc(${activeIndex} * ${100 / tabs.length}% + 4px)`,
                width: `calc(${100 / tabs.length}% - 8px)`,
              }}
            />
            
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "relative z-10 flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 outline-none",
                  activeTab === tab.id
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          <section className="space-y-4">
            
            {/* Trends Tab */}
            {activeTab === "trends" && (
              <div className="space-y-4 animate-fade-in">
                {/* Highlights */}
                <div className="grid grid-cols-2 gap-3">
                  {bestMonth && bestMonth.totalFare > 0 && (
                    <Card className="border-success/20 bg-success/5 dark:bg-success/10 shadow-sm relative overflow-hidden">
                      <CardContent className="p-3.5 flex items-start gap-2.5 relative z-10">
                        <div className="p-1.5 rounded-lg bg-success/15 shrink-0 mt-0.5">
                          <ArrowUpRight className="h-4 w-4 text-success" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Bulan Terbaik</p>
                          <p className="text-xs font-bold text-foreground mt-0.5">{bestMonth.month}</p>
                          <p className="text-sm font-extrabold text-success mt-0.5">Rp {formatRupiah(bestMonth.totalFare)}</p>
                        </div>
                      </CardContent>
                      <ArrowUpRight className="absolute -right-3 -bottom-3 h-16 w-16 text-success/5 dark:text-success/10 stroke-[1.5] pointer-events-none" />
                    </Card>
                  )}
                  {worstMonth && worstMonth.totalFare > 0 && (
                    <Card className="border-destructive/20 bg-destructive/5 dark:bg-destructive/10 shadow-sm relative overflow-hidden">
                      <CardContent className="p-3.5 flex items-start gap-2.5 relative z-10">
                        <div className="p-1.5 rounded-lg bg-destructive/15 shrink-0 mt-0.5">
                          <ArrowDownRight className="h-4 w-4 text-destructive" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Bulan Terendah</p>
                          <p className="text-xs font-bold text-foreground mt-0.5">{worstMonth.month}</p>
                          <p className="text-sm font-extrabold text-destructive mt-0.5">Rp {formatRupiah(worstMonth.totalFare)}</p>
                        </div>
                      </CardContent>
                      <ArrowDownRight className="absolute -right-3 -bottom-3 h-16 w-16 text-destructive/5 dark:text-destructive/10 stroke-[1.5] pointer-events-none" />
                    </Card>
                  )}
                </div>

                {/* Monthly Earnings Chart */}
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Tren Pendapatan Bulanan</h4>
                      <p className="text-[11px] text-muted-foreground">Progresi pembagian hasil bulanan dalam Juta Rupiah</p>
                    </div>

                    <div className="h-56 w-full" role="img" aria-label="Grafik tren bulanan">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyChartData} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                          <defs>
                            <linearGradient id="colorBagiHasil" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorDriver" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="oklch(0.65 0.18 85)" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="oklch(0.65 0.18 85)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}Jt`} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: number) => [`Rp ${value.toFixed(1)} Jt`, '']}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                          <Area type="monotone" dataKey="Bagi Hasil" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorBagiHasil)" />
                          <Area type="monotone" dataKey="Pendapatan Driver" stroke="oklch(0.65 0.18 85)" strokeWidth={2} fillOpacity={1} fill="url(#colorDriver)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Driver Monthly Deposit */}
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">Setoran Driver per Bulan</h4>
                        <p className="text-[11px] text-muted-foreground">Jumlah setoran tiap driver untuk periode {selectedDepositMonthLabel}</p>
                      </div>

                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                        <div className="grid w-full grid-cols-[minmax(0,1fr)_96px] gap-2 sm:flex sm:w-auto">
                          <Select value={selectedDepositMonthNumber} onValueChange={handleDepositMonthChange}>
                            <SelectTrigger size="sm" className="h-9 w-full rounded-full px-4 sm:w-[130px]">
                              <SelectValue placeholder="Bulan" />
                            </SelectTrigger>
                            <SelectContent>
                              {depositMonthSelectOptions.map((month) => (
                                <SelectItem key={month.value} value={month.value}>
                                  {month.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={selectedDepositYear} onValueChange={handleDepositYearChange}>
                            <SelectTrigger size="sm" className="h-9 w-full rounded-full px-4 sm:w-[96px]">
                              <SelectValue placeholder="Tahun" />
                            </SelectTrigger>
                            <SelectContent>
                              {depositYearOptions.map((year) => (
                                <SelectItem key={year} value={year}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-full gap-2 rounded-full text-xs sm:w-auto"
                          onClick={handleDownloadDepositRecap}
                          disabled={driverDepositRows.length === 0}
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-border bg-secondary/15 p-2.5">
                        <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Wajib Setor</p>
                        <p className="mt-1 break-words text-[11px] font-extrabold leading-tight text-foreground">Rp {formatRupiah(driverDepositSummary.total)}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-primary/5 p-2.5">
                        <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Masuk</p>
                        <p className="mt-1 break-words text-[11px] font-extrabold leading-tight text-primary">Rp {formatRupiah(driverDepositSummary.paid)}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-amber-500/5 p-2.5">
                        <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Sisa</p>
                        <p className="mt-1 break-words text-[11px] font-extrabold leading-tight text-amber-600">Rp {formatRupiah(driverDepositSummary.remaining)}</p>
                      </div>
                    </div>

                    {driverDepositRows.length > 0 ? (
                      <>
                        <div
                          className="w-full"
                          style={{ height: `${driverDepositChartHeight}px` }}
                          role="img"
                          aria-label="Grafik setoran driver per bulan"
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={driverDepositRows}
                              layout="vertical"
                              margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
                            >
                              <XAxis
                                type="number"
                                tick={{ fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `${Math.round(Number(value) / 1000000)}Jt`}
                              />
                              <YAxis
                                type="category"
                                dataKey="driver"
                                width={88}
                                tick={{ fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={shortenDriverName}
                              />
                              <Tooltip
                                contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '11px' }}
                                formatter={(value: number, name: string) => [`Rp ${formatRupiah(Number(value || 0))}`, name]}
                              />
                              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                              <Bar dataKey="paid" name="Setoran Masuk" stackId="setoran" fill="var(--primary)" radius={[0, 0, 0, 0]} />
                              <Bar dataKey="remaining" name="Sisa Setoran" stackId="setoran" fill="oklch(0.72 0.16 75)" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="divide-y divide-border rounded-xl border border-border">
                          {driverDepositRows.map((driver) => {
                            const completion = driver.total > 0 ? Math.min(Math.round((driver.paid / driver.total) * 100), 100) : 0

                            return (
                              <div key={driver.driver} className="p-3 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-foreground">{driver.driver}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{driver.trips} trip - {completion}% masuk</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-xs font-bold text-foreground">Rp {formatRupiah(driver.total)}</p>
                                    <p className="text-[9px] text-muted-foreground mt-0.5">Wajib setor</p>
                                  </div>
                                </div>
                                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                  <div className="h-full rounded-full bg-primary" style={{ width: `${completion}%` }} />
                                </div>
                                <div className="flex flex-col gap-1 text-[10px] sm:flex-row sm:justify-between">
                                  <span className="text-primary font-semibold">Masuk Rp {formatRupiah(driver.paid)}</span>
                                  <span className="text-amber-600 font-semibold">Sisa Rp {formatRupiah(driver.remaining)}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="p-8 text-center text-xs text-muted-foreground">
                        Belum ada data setoran driver untuk {selectedDepositMonthLabel}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Average Fare Trend */}
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Tren Rata-rata Argo per Trip</h4>
                      <p className="text-[11px] text-muted-foreground">Rata-rata nilai argo yang diperoleh per trip</p>
                    </div>

                    <div className="h-44 w-full" role="img" aria-label="Grafik argo rata-rata">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyChartData} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                          <defs>
                            <linearGradient id="colorAvgFare" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="oklch(0.7 0.16 120)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="oklch(0.7 0.16 120)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `Rp ${formatRupiah(Math.round(v))}`} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(value: number) => [`Rp ${formatRupiah(Math.round(value))}`, 'Rata-rata']}
                          />
                          <Area type="monotone" dataKey="avgFare" stroke="oklch(0.7 0.16 120)" strokeWidth={2} fillOpacity={1} fill="url(#colorAvgFare)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Historical Data Table */}
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Tabel Data Historis</h4>
                      <p className="text-[11px] text-muted-foreground">Rincian angka performa riil dari bulan ke bulan</p>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-border bg-card">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-secondary/40 border-b border-border text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                            <th className="py-2.5 px-3">Bulan</th>
                            <th className="py-2.5 px-3 text-right">Trip</th>
                            <th className="py-2.5 px-3 text-right">Total Argo</th>
                            <th className="py-2.5 px-3 text-right">{isAdmin ? "Bagi Hasil" : "Pendapatan"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {monthlyChartData.map((row) => (
                            <tr key={row.month} className="hover:bg-secondary/10 transition-colors">
                              <td className="py-2 px-3 font-medium text-foreground">{row.month}</td>
                              <td className="py-2 px-3 text-right text-muted-foreground">{row.tripCount}</td>
                              <td className="py-2 px-3 text-right text-foreground font-semibold">Rp {formatRupiah(row.totalFare)}</td>
                              <td className="py-2 px-3 text-right text-primary font-bold">
                                Rp {formatRupiah(isAdmin ? row.companyShare : row.driverShare)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Analysis Box */}
                <div className="rounded-xl border border-border bg-secondary/20 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Info className="h-4 w-4 text-primary" />
                    <span>Analisis Pertumbuhan Bulanan</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Total argo Anda bulan ini adalah <b>Rp {formatRupiah(finances.argoTotal)}</b>, mengalami 
                    {finances.argoGrowth >= 0 ? (
                      <span className="text-success font-semibold"> kenaikan sebanyak {finances.argoGrowth}% </span>
                    ) : (
                      <span className="text-destructive font-semibold"> penurunan sebanyak {Math.abs(finances.argoGrowth)}% </span>
                    )} 
                    dibandingkan bulan lalu (Rp {formatRupiah(finances.prevArgoTotal)}).
                  </p>
                </div>

                {/* AI Financial Insights Card */}
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                      <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                      <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Rekomendasi Pintar AI</h4>
                    </div>

                    <div className="space-y-3 pt-1">
                      {aiInsights.map((insight, idx) => {
                        let colorClasses = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200/50"
                        if (insight.type === "success") {
                          colorClasses = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50"
                        } else if (insight.type === "warning") {
                          colorClasses = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50"
                        } else if (insight.type === "danger") {
                          colorClasses = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50"
                        }

                        return (
                          <div key={idx} className={cn("p-3 rounded-xl border text-[11px] leading-relaxed", colorClasses)}>
                            <p className="font-bold mb-1 text-xs">{insight.title}</p>
                            <p className="text-muted-foreground font-light">{insight.desc}</p>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Shares Tab */}
            {activeTab === "shares" && (
              <Card className="border-border bg-card">
                <CardContent className="p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Analisis Profitabilitas & Kontribusi</h4>
                    <p className="text-[11px] text-muted-foreground">Pembagian keuntungan dari argo (40% Perusahaan / 60% Driver)</p>
                  </div>

                  {/* Progress bars illustrating the division of share */}
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-foreground">Bagian Perusahaan (40%)</span>
                        <span className="font-bold text-primary">Rp {formatRupiah(finances.companyShare)}</span>
                      </div>
                      <div className="h-3 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: "40%" }} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-foreground">Bagian Driver (60%)</span>
                        <span className="font-bold text-success">Rp {formatRupiah(finances.driverShare)}</span>
                      </div>
                      <div className="h-3 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: "60%" }} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="rounded-xl border border-border bg-secondary/15 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Rata-rata Margin</p>
                      <p className="text-lg font-extrabold text-foreground mt-1">40.0%</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Wajib Setor Tetap</p>
                    </div>
                    <div className="rounded-xl border border-border bg-secondary/15 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Estimasi Driver Take-home</p>
                      <p className="text-lg font-extrabold text-foreground mt-1">60.0%</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Pendapatan Driver</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Orders Tab */}
            {activeTab === "orders" && (
              <Card className="border-border bg-card">
                <CardContent className="p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Pembagian Tipe Order</h4>
                    <p className="text-[11px] text-muted-foreground">Perbandingan transaksi dari Order Online vs Offline</p>
                  </div>

                  {totalOrderTypeFare > 0 ? (
                    <div className="flex items-center justify-between gap-6 py-2">
                      <div className="h-36 w-36 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={orderTypeData}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={50}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {orderTypeData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '11px' }}
                              formatter={(value: number) => [`Rp ${formatRupiah(value)}`, '']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        {orderTypeData.map((ot) => {
                          const percentage = totalOrderTypeFare > 0 ? Math.round((ot.value / totalOrderTypeFare) * 100) : 0
                          return (
                            <div key={ot.name} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ot.color }} />
                                  <span className="font-semibold text-foreground">{ot.name}</span>
                                </div>
                                <span className="font-bold text-foreground">{percentage}%</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground pl-4">
                                Rp {formatRupiah(ot.value)} • {ot.count} trip
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      Tidak ada data tipe order untuk periode ini
                    </div>
                  )}

                  <div className="border-t border-border pt-4 grid grid-cols-2 gap-4">
                    {orderTypeData.map((ot) => {
                      const avgFare = ot.count > 0 ? Math.round(ot.value / ot.count) : 0
                      return (
                        <div key={ot.name} className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground">{ot.name} Avg. Argo / Trip</p>
                          <p className="text-sm font-bold text-foreground">Rp {formatRupiah(avgFare)}</p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Admin Leaderboard & Service Tab */}
            {activeTab === "admin" && isAdmin && (
              <div className="space-y-4">
                
                {/* Driver Rankings Leaderboard */}
                <Card className="border-border bg-card">
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Peringkat Kontribusi Setoran Driver</h4>
                      <p className="text-[11px] text-muted-foreground">Supir dengan setoran wajib terbesar bulan ini</p>
                    </div>

                    <div className="divide-y divide-border">
                      {data.driverIncome && data.driverIncome.length > 0 ? (
                        data.driverIncome.map((driver, index) => {
                          const driverTotal = driver.total || 0
                          const driverTrips = driver.trips || 0
                          const rankColor = index === 0 ? "text-amber-500" : index === 1 ? "text-gray-400" : index === 2 ? "text-amber-700" : "text-muted-foreground"
                          
                          return (
                            <div key={driver.driver} className="flex items-center justify-between py-2.5 gap-3">
                              <div className="flex items-center gap-3">
                                <span className={cn("text-xs font-bold w-4 text-center", rankColor)}>
                                  {index + 1}
                                </span>
                                <div>
                                  <p className="text-xs font-semibold text-foreground">{driver.driver}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{driverTrips} trip selesai</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-foreground">Rp {formatRupiah(driverTotal)}</p>
                                <p className="text-[9px] text-muted-foreground mt-0.5">Setoran (40%)</p>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-muted-foreground">Belum ada data kontribusi supir</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Service Logs summary */}
                <Card className="border-border bg-card">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">Log Pengeluaran Servis Kendaraan</h4>
                        <p className="text-[11px] text-muted-foreground">Histori biaya perawatan kendaraan operasional</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-primary flex items-center gap-0.5 px-2"
                        onClick={() => router.push("/service")}
                      >
                        Detail
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="divide-y divide-border">
                      {services && services.length > 0 ? (
                        services.slice(0, 4).map((s) => {
                          const dateObj = new Date(s.date)
                          const formattedDate = !Number.isNaN(dateObj.getTime())
                            ? dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "short" })
                            : s.date
                          return (
                            <div key={s.id} className="flex items-center justify-between py-2.5">
                              <div>
                                <p className="text-xs font-semibold text-foreground">{s.vehicle}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {s.driver} • {s.type} • {formattedDate}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-destructive">Rp {formatRupiah(s.cost)}</p>
                                <Badge className={cn(
                                  "text-[8px] px-1 py-0 mt-0.5",
                                  s.status === "selesai" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                                )}>
                                  {s.status}
                                </Badge>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-muted-foreground">Belum ada pengeluaran servis</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

              </div>
            )}
          </section>

        </main>
      </div>
    </PullToRefresh>
  )
}
