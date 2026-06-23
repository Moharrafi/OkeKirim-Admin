export type MonthlyDriverDepositRow = {
  driver: string
  totalFare: number
  total: number
  driverShare: number
  paid: number
  remaining: number
  trips: number
}

export type MonthlyDepositSummary = {
  totalFare: number
  total: number
  driverShare: number
  paid: number
  remaining: number
  trips: number
}

export type MonthlyProfitSummary = MonthlyDepositSummary & {
  serviceCost: number
  netProfit: number
  cashProfit: number
  completionRate: number
}

function formatRupiah(value: number) {
  return Number(value || 0).toLocaleString("id-ID")
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

function createPdfBuffer(pageStreams: string[], width: number, height: number) {
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

  return Buffer.from(pdf, "utf8")
}

export function createMonthlyDepositRecapPdf(
  rows: MonthlyDriverDepositRow[],
  summary: MonthlyDepositSummary,
  profit: MonthlyProfitSummary,
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
    drawMiniMetric(1, "Wajib Setor", `Rp ${formatRupiah(profit.total)}`, [0.95, 0.985, 0.965], [0.05, 0.35, 0.22])
    drawMiniMetric(2, "Setoran Masuk", `Rp ${formatRupiah(profit.paid)}`, [0.94, 0.985, 0.96], [0.08, 0.5, 0.3])
    drawMiniMetric(3, "Pendapatan Driver", `Rp ${formatRupiah(profit.driverShare)}`, [0.995, 0.98, 0.95], [0.72, 0.36, 0.08])
    drawMiniMetric(4, "Biaya Servis", `Rp ${formatRupiah(profit.serviceCost)}`, [0.995, 0.965, 0.965], [0.76, 0.2, 0.18])
    drawMiniMetric(5, "Sisa Setoran", `Rp ${formatRupiah(profit.remaining)}`, [0.995, 0.975, 0.95], [0.74, 0.4, 0.04])

    rect(margin, 264, contentWidth, 52, [0.96, 0.985, 0.97], COLOR_BORDER)
    rect(margin, 264, 3, 52, COLOR_PRIMARY)
    text(margin + 16, 278, "Detail Perhitungan", { size: 9.6, font: "F2", fill: COLOR_PRIMARY })
    text(margin + 16, 296, `Laba Bersih = Rp ${formatRupiah(profit.total)} - Rp ${formatRupiah(profit.serviceCost)} = Rp ${formatRupiah(profit.netProfit)}`, { size: 8.8, fill: [0.28, 0.34, 0.31] })

    text(completionRight - completionBarWidth, 278, "Realisasi Setoran", { size: 9.4, font: "F2", fill: COLOR_PRIMARY })
    text(completionRight, 278, `${profit.completionRate}%`, { size: 10.6, font: "F2", fill: [0.02, 0.42, 0.22], align: "right" })
    rect(completionRight - completionBarWidth, 292, completionBarWidth, 6, [0.9, 0.92, 0.91])
    rect(completionRight - completionBarWidth, 292, completionBarWidth * (profit.completionRate / 100), 6, [0.1, 0.7, 0.45])
    text(completionRight, 306, `Masuk Rp ${formatRupiah(profit.paid)} dari Rp ${formatRupiah(profit.total)}`, { size: 7.8, fill: COLOR_TEXT_MUTED, align: "right" })
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

  return createPdfBuffer(pages.map((page) => page.join("\n")), width, height)
}

