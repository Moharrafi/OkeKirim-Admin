"use client"

import { useEffect, useState } from "react"
import { Sparkles, Download, X, ArrowUpCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

const CURRENT_APP_VERSION = "2.0.0"

interface VersionData {
  latestVersion: string
  versionCode: number
  forceUpdate: boolean
  apkUrl: string
  downloadUrl: string
  releaseNotes: string[]
  updatedAt?: string
}

function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0)
  const l = parse(latest)
  const c = parse(current)

  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const numL = l[i] || 0
    const numC = c[i] || 0
    if (numL > numC) return true
    if (numL < numC) return false
  }
  return false
}

export function UpdateChecker() {
  const [updateData, setUpdateData] = useState<VersionData | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    async function checkVersion() {
      try {
        const res = await fetch("/api/app-version")
        if (!res.ok) return
        const data: VersionData = await res.json()

        if (isNewerVersion(data.latestVersion, CURRENT_APP_VERSION)) {
          const dismissedKey = `dismissed_update_${data.latestVersion}`
          const dismissed = sessionStorage.getItem(dismissedKey)

          if (data.forceUpdate || !dismissed) {
            setUpdateData(data)
            setOpen(true)
          }
        }
      } catch (err) {
        console.error("Failed to check app version:", err)
      }
    }

    // Delay check slightly for smooth UX on page load
    const timer = setTimeout(checkVersion, 1500)
    return () => clearTimeout(timer)
  }, [])

  if (!updateData || !open) return null

  const handleDownload = () => {
    const targetUrl = updateData.downloadUrl || updateData.apkUrl || "#"
    window.open(targetUrl, "_blank")
  }

  const handleDismiss = () => {
    if (updateData.forceUpdate) return
    sessionStorage.setItem(`dismissed_update_${updateData.latestVersion}`, "true")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 border-blue-500/20 bg-card shadow-2xl animate-in fade-in zoom-in-95">
        <DialogHeader className="text-center sm:text-left">
          <div className="mx-auto sm:mx-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 mb-3">
            <ArrowUpCircle className="h-8 w-8 stroke-[2.2] animate-bounce" />
          </div>
          <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2 justify-center sm:justify-start">
            Pembaruan Aplikasi Tersedia!
            <span className="bg-blue-500/10 text-blue-600 text-xs px-2 py-0.5 rounded-full font-bold border border-blue-500/20">
              v{updateData.latestVersion}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Versi baru **OkeMitra** telah rilis. Dapatkan nada dering baru & peningkatan performa!
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-border/60">
          <p className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Catatan Pembaruan:
          </p>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {updateData.releaseNotes.map((note, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-2">
          <Button
            onClick={handleDownload}
            className="w-full sm:flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-blue-500/25 active:scale-95 transition-all gap-2"
          >
            <Download className="h-4 w-4 stroke-[2.5]" />
            Unduh & Install APK
          </Button>

          {!updateData.forceUpdate && (
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="w-full sm:w-auto font-semibold h-11 rounded-xl border-border/80 hover:bg-secondary text-muted-foreground"
            >
              Nanti Saja
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
