import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  try {
    let apkPath = path.join(process.cwd(), "public", "downloads", "OkeMitra-v2.1.0.apk")
    if (!fs.existsSync(apkPath)) {
      apkPath = path.join(process.cwd(), "public", "downloads", "OkeMitra-latest.apk")
    }

    if (fs.existsSync(apkPath)) {
      const fileBuffer = fs.readFileSync(apkPath)

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/vnd.android.package-archive",
          "Content-Disposition": 'attachment; filename="OkeMitra-v2.1.0.apk"',
          "Content-Length": String(fileBuffer.length),
        },
      })
    }

    return NextResponse.json({ error: "APK file not found on server" }, { status: 444 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
