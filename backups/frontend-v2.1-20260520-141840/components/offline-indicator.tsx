"use client"

import { useState, useEffect } from "react"
import { WifiOff } from "lucide-react"

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)

    setIsOffline(!navigator.onLine)
    window.addEventListener("offline", handleOffline)
    window.addEventListener("online", handleOnline)

    return () => {
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("online", handleOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-destructive text-destructive-foreground text-center py-2 text-xs font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
      <WifiOff className="h-3.5 w-3.5" />
      Tidak ada koneksi internet
    </div>
  )
}
