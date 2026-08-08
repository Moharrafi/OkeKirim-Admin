import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    latestVersion: "2.1.0",
    versionCode: 210,
    minSupportedVersion: "1.0.0",
    forceUpdate: false,
    apkUrl: "/api/download-apk",
    downloadUrl: "/api/download-apk",
    releaseNotes: [
      "Nada dering pengingat setoran baru (melodi 2.2 detik)",
      "Peningkatan tampilan dashboard modern & presisi",
      "Personalisasi notifikasi per akun supir",
      "Perbaikan performa & kestabilan aplikasi"
    ],
    updatedAt: "2026-08-08"
  })
}
