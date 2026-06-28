"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global UI Error caught:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-500/10 dark:bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mb-6 animate-bounce">
        <AlertTriangle className="h-8 w-8" />
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">
        Oops, Terjadi Kesalahan!
      </h2>
      
      <p className="text-sm text-muted-foreground max-w-md mb-8">
        Terjadi kesalahan tidak terduga pada sistem antarmuka. Silakan coba memuat ulang halaman atau kembali ke dashboard.
      </p>

      {error.message && (
        <div className="bg-card border border-border p-4 rounded-xl max-w-md w-full mb-8 text-left overflow-auto max-h-40">
          <p className="text-xs font-mono text-red-400 break-all">
            {error.toString()}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Button
          onClick={() => reset()}
          className="flex-1 rounded-xl bg-primary text-primary-foreground gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Coba Lagi
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = "/"
          }}
          className="flex-1 rounded-xl border-border gap-2"
        >
          <Home className="h-4 w-4" />
          Dashboard
        </Button>
      </div>
    </div>
  )
}
