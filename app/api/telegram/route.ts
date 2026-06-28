import { NextRequest, NextResponse } from "next/server"
import { getBatchDepositDue } from "@/lib/deposit-batch"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || ""
const SEPARATOR = "-".repeat(32)
const ICON_INBOX = "\u{1F4E5}"
const ICON_DRIVER = "\u{1F464}"
const ICON_LIST = "\u{1F4CB}"
const ICON_CHECK = "\u2705"
const FOOTER_DOT = "\u2022"

interface BatchItem {
  route: string
  fare: number
  companyShare?: number
  sisa?: number
  type: string
}

function normalizeTelegramText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u2022\u00b7]/g, "-")
}

function escapeHtml(value: unknown) {
  return normalizeTelegramText(value)
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
    .map(([label, value]) => `${label.padEnd(labelWidth, " ")} : ${escapeHtml(value)}`)
    .join("\n")
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      isCorrection,
      messageText,
      driver,
      amount,
      route,
      orderType,
      fare,
      companyShare,
      imageBase64,
      batchItems,
      sisaSetoran,
      proofMismatchReason,
      orderSisa,
    } = body

    if (isCorrection && messageText) {
      const response = await sendTextMessage(messageText)
      return NextResponse.json({ success: true, response })
    }

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
      const harusSetor = getBatchDepositDue(items)
      const sisaBatch = Math.max(harusSetor - Number(amount || 0), 0)
      const types = [...new Set(items.map((item) => item.type === "offline" ? "Offline" : "Online"))]
      const typeStr = types.join(" & ")
      const infoRows: Array<[string, string]> = [
        ["Setoran", formatRupiah(amount)],
        ["Jumlah", `${items.length} orderan`],
        ["Harus Disetor", formatRupiah(harusSetor)],
        ...(sisaBatch > 0 ? [["Sisa", formatRupiah(sisaBatch)] as [string, string]] : []),
        ["Tipe", typeStr],
        ["Tanggal", waktu],
      ]

      if (sisaSetoran !== undefined && sisaSetoran > 0) {
        infoRows.push(["Sisa Total Setoran", formatRupiah(sisaSetoran)])
      }
      if (proofMismatchReason) {
        infoRows.push(["Alasan Selisih", String(proofMismatchReason)])
      }

      const routeList = items
        .map((item, i) => {
          const targetShare = item.companyShare ?? Math.round(item.fare * 0.4)
          const sisaStr = (item.sisa !== undefined && item.sisa > 0 && item.sisa < targetShare)
            ? ` (sisa: ${formatRupiah(item.sisa)})`
            : ""
          return `${i + 1}. ${escapeHtml(item.route || "-")} (${formatRupiah(item.fare)})${sisaStr}`
        })
        .join("\n")

      message = `${ICON_INBOX} <b>SETORAN MASUK (BATCH)</b>\n` +
        `${SEPARATOR}\n\n` +
        `${ICON_DRIVER} <b>${escapeHtml(driver)}</b>\n\n` +
        `<pre>${formatInfoRows(infoRows)}</pre>\n\n` +
        `${ICON_LIST} <b>Rincian Rute:</b>\n` +
        `<pre>${routeList}</pre>\n\n` +
        `${SEPARATOR}\n` +
        (imageBase64 ? `\n${ICON_CHECK} Bukti transfer terlampir\n` : "") +
        `\n<i>OkeMitra ${FOOTER_DOT} Sistem Otomatis</i>`
    } else {
      const displayFare = Number(fare || 0) || Math.round(Number(companyShare || amount || 0) / 0.4)
      const infoRows: Array<[string, string]> = [
        ["Setoran", formatRupiah(amount)],
        ["Argo", formatRupiah(displayFare)],
      ]

      if (orderSisa !== undefined && Number(orderSisa) > 0) {
        infoRows.push(["Sisa", formatRupiah(orderSisa)])
      }

      infoRows.push(
        ["Rute", escapeHtml(route || "-")],
        ["Tipe", orderType === "offline" ? "Offline" : "Online"],
        ["Tanggal", waktu]
      )

      if (sisaSetoran !== undefined && sisaSetoran > 0) {
        infoRows.push(["Sisa Total Setoran", formatRupiah(sisaSetoran)])
      }
      if (proofMismatchReason) {
        infoRows.push(["Alasan Selisih", String(proofMismatchReason)])
      }

      message = `${ICON_INBOX} <b>SETORAN MASUK</b>\n` +
        `${SEPARATOR}\n\n` +
        `${ICON_DRIVER} <b>${escapeHtml(driver)}</b>\n\n` +
        `<pre>${formatInfoRows(infoRows)}</pre>\n` +
        `\n${SEPARATOR}\n` +
        (imageBase64 ? `\n${ICON_CHECK} Bukti transfer terlampir\n` : "") +
        `\n<i>OkeMitra ${FOOTER_DOT} Sistem Otomatis</i>`
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
