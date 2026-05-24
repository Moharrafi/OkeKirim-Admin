import { NextRequest, NextResponse } from "next/server"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || ""

interface BatchItem {
  route: string
  fare: number
  type: string
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
      // Batch payment format
      const items = batchItems as BatchItem[]
      const totalArgo = items.reduce((sum, item) => sum + (item.fare || 0), 0)
      const types = [...new Set(items.map(i => i.type === "offline" ? "Offline" : "Online"))]
      const typeStr = types.join(" & ")

      let routeList = items.map((item, i) => 
        `   ${i + 1}. ${item.route} (Rp ${Number(item.fare).toLocaleString("id-ID")})`
      ).join("\n")

      message = `📥 <b>SETORAN MASUK (BATCH)</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `👤 <b>${driver}</b>\n\n` +
        `<b>Setoran</b>       : Rp ${Number(amount).toLocaleString("id-ID")}\n` +
        `<b>Jumlah</b>       : ${items.length} orderan\n` +
        `<b>Argo Total</b>  : Rp ${totalArgo.toLocaleString("id-ID")}\n` +
        `<b>Tipe</b>             : ${typeStr}\n` +
        `<b>Tanggal</b>       : ${waktu}\n`

      if (sisaSetoran !== undefined && sisaSetoran > 0) {
        message += `<b>Sisa Setoran</b> : Rp ${Number(sisaSetoran).toLocaleString("id-ID")}\n`
      }

      message += `\n<b>Rincian Rute:</b>\n${routeList}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        (imageBase64 ? `✅ Bukti transfer terlampir\n\n` : ``) +
        `<code>OkeMitra • Sistem Otomatis</code>`
    } else {
      // Single payment format
      message = `📥 <b>SETORAN MASUK</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `👤 <b>${driver}</b>\n\n` +
        `<b>Setoran</b>       : Rp ${Number(amount).toLocaleString("id-ID")}\n` +
        `<b>Rute</b>             : ${route || "-"}\n` +
        `<b>Argo</b>             : Rp ${Number(fare || 0).toLocaleString("id-ID")}\n` +
        `<b>Tipe</b>             : ${orderType === "offline" ? "Offline" : "Online"}\n` +
        `<b>Tanggal</b>       : ${waktu}\n`

      if (sisaSetoran !== undefined && sisaSetoran > 0) {
        message += `<b>Sisa Setoran</b> : Rp ${Number(sisaSetoran).toLocaleString("id-ID")}\n`
      }

      message += `\n━━━━━━━━━━━━━━━━━━\n` +
        (imageBase64 ? `✅ Bukti transfer terlampir\n\n` : ``) +
        `<code>OkeMitra • Sistem Otomatis</code>`
    }

    // If there's an image, send as photo with caption
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
