import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  try {
    const localApkPath = path.join(process.cwd(), "public", "downloads", "OkeMitra-latest.apk")

    if (fs.existsSync(localApkPath)) {
      const fileStream = fs.createReadStream(localApkPath)
      const stat = fs.statSync(localApkPath)

      return new NextResponse(fileStream as any, {
        headers: {
          "Content-Type": "application/vnd.android.package-archive",
          "Content-Disposition": 'attachment; filename="OkeMitra-v2.1.0.apk"',
          "Content-Length": String(stat.size),
        },
      })
    }

    // Fallback if local APK is not hosted yet, redirect to GitHub release or download page
    return NextResponse.redirect("https://github.com/Moharrafi/OkeKirim/releases")
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
