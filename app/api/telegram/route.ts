import { NextRequest, NextResponse } from "next/server"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || ""
const FIGURE_SPACE = "\u2007"
const SEPARATOR = "\u2501".repeat(24)

interface BatchItem {
  route: string
  fare: number
  type: string
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function formatRupiah(value: unknown) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`
}

function formatInfoRows(rows: Array<[string, string]>) {
  const labelWidth = Math.max(...rows.map(([label]) => label.length))

  return rows
    .map(([label, value]) => `${label}${FIGURE_SPACE.repeat(labelWidth - label.length)} : ${escapeHtml(value)}`)
    .join("\n")
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { driver, amount, route, orderType, fare, imageBase64, batchItems, sisaSetoran } = body

    if (!driver || !amount) {
      return NextResponse.json({ error: "Driver dan amount wajib" }, { status: 400 })
    }

    const waktu = new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

    let message = ""

    if (batchItems && Array.isArray(batchItems) && batchItems.length > 1) {
      const items = batchItems as BatchItem[]
      const totalArgo = items.reduce((sum, item) => sum + (item.fare || 0), 0)
      const harusSetor = Math.round(totalArgo * 0.4)
      const types = [...new Set(items.map((item) => item.type === "offline" ? "Offline" : "Online"))]
      const typeStr = types.join(" & ")
      const infoRows: Array<[string, string]> = [
        ["Setoran", formatRupiah(amount)],
        ["Jumlah", `${items.length} orderan`],
        ["Harus Disetor", formatRupiah(harusSetor)],
        ["Tipe", typeStr],
        ["Tanggal", waktu],
      ]

      if (sisaSetoran !== undefined && sisaSetoran > 0) {
        infoRows.push(["Sisa Setoran", formatRupiah(sisaSetoran)])
      }

      const routeList = items
        .map((item, i) => `${i + 1}. ${escapeHtml(item.route || "-")} (${formatRupiah(item.fare)})`)
        .join("\n")

      message = `📥 <b>SETORAN MASUK (BATCH)</b>\n` +
        `${SEPARATOR}\n\n` +
        `👤 <b>${escapeHtml(driver)}</b>\n\n` +
        `<pre>${formatInfoRows(infoRows)}</pre>\n\n` +
        `📋 <b>Rincian Rute:</b>\n` +
        `<pre>${routeList}</pre>\n\n` +
        `${SEPARATOR}\n` +
        (imageBase64 ? `\n✅ Bukti transfer terlampir\n` : "") +
        `\n<i>OkeMitra • Sistem Otomatis</i>`
    } else {
      message = `📥 <b>SETORAN MASUK</b>\n` +
        `${SEPARATOR}\n\n` +
        `👤 <b>${escapeHtml(driver)}</b>\n\n` +
        `Setoran\t\t\t:  ${formatRupiah(amount)}\n` +
        `Rute\t\t\t\t:  ${escapeHtml(route || "-")}\n` +
        `Argo\t\t\t\t:  ${formatRupiah(fare)}\n` +
        `Tipe\t\t\t\t:  ${orderType === "offline" ? "Offline" : "Online"}\n` +
        `Tanggal\t\t\t:  ${escapeHtml(waktu)}\n` +
        (sisaSetoran !== undefined && sisaSetoran > 0 ? `Sisa\t\t\t\t:  ${formatRupiah(sisaSetoran)}\n` : "") +
        `\n${SEPARATOR}\n` +
        (imageBase64 ? `\n✅ Bukti transfer terlampir\n` : "") +
        `\n<i>OkeMitra • Sistem Otomatis</i>`
    }

    if (imageBase64) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "")
      const buffer = Buffer.from(base64Data, "base64")
      const mimeMatch = imageBase64.match(/^data:image\/(\w+);base64,/)
      const ext = mimeMatch ? mimeMatch[1] : "jpg"

      const formData = new FormData()
      formData.append("chat_id", CHAT_ID)
      formData.append("caption", message)
      formData.append("parse_mode", "HTML")
      formData.append("photo", new Blob([buffer], { type: `image/${ext}` }), `bukti_tf.${ext}`)

      const photoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        body: formData,
      })

      const photoResult = await photoRes.json()

      if (!photoResult.ok) {
        console.error("Telegram photo error:", photoResult)
        await sendTextMessage(message)
      }
    } else {
      await sendTextMessage(message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Telegram notification error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function sendTextMessage(text: string) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
    }),
  })
  return res.json()
}
