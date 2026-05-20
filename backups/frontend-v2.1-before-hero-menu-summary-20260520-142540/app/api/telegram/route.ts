import { NextRequest, NextResponse } from "next/server"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || ""

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { driver, amount, route, orderType, fare, imageBase64 } = body

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

    const message = `📥 <b>SETORAN MASUK</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 <b>${driver}</b>\n\n` +
      `<b>Setoran</b>         Rp ${Number(amount).toLocaleString("id-ID")}\n` +
      `<b>Argo</b>               Rp ${Number(fare || 0).toLocaleString("id-ID")}\n` +
      `<b>Rute</b>               ${route || "-"}\n` +
      `<b>Tipe</b>               ${orderType === "offline" ? "Offline" : "Online"}\n` +
      `<b>Tanggal</b>          ${waktu}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      (imageBase64 ? `✅ Bukti transfer terlampir\n\n` : ``) +
      `<code>OkeMitra • Sistem Otomatis</code>`

    // If there's an image, send as photo with caption
    if (imageBase64) {
      // Convert base64 to buffer
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "")
      const buffer = Buffer.from(base64Data, "base64")

      // Determine file extension
      const mimeMatch = imageBase64.match(/^data:image\/(\w+);base64,/)
      const ext = mimeMatch ? mimeMatch[1] : "jpg"

      // Send photo with caption using multipart form
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
        // Fallback: send text only if photo fails
        console.error("Telegram photo error:", photoResult)
        await sendTextMessage(message)
      }
    } else {
      // No image, send text only
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
