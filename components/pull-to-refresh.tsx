"use client"

import { useState, useRef, useCallback } from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const isPulling = useRef(false)

  const THRESHOLD = 80

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only activate pull-to-refresh when page is scrolled to top
    if (window.scrollY <= 0) {
      startY.current = e.touches[0].clientY
      isPulling.current = true
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const currentY = e.touches[0].clientY
    const diff = currentY - startY.current
    if (diff > 0 && window.scrollY <= 0) {
      setPullDistance(Math.min(diff * 0.4, 120))
    } else {
      // User is scrolling up normally
      isPulling.current = false
      setPullDistance(0)
    }
  }, [refreshing])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return
    isPulling.current = false
    
    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true)
      setPullDistance(THRESHOLD)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, refreshing, onRefresh])

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="fixed left-0 right-0 flex items-center justify-center z-50 pointer-events-none"
          style={{ top: Math.max(0, pullDistance - 40) }}
        >
          <div className="bg-card rounded-full p-2 shadow-md border border-border">
            <RefreshCw
              className={cn(
                "h-5 w-5 text-primary",
                refreshing && "animate-spin",
                pullDistance >= THRESHOLD && !refreshing && "text-success"
              )}
              style={{ transform: refreshing ? undefined : `rotate(${pullDistance * 3}deg)` }}
            />
          </div>
        </div>
      )}

      {children}
    </div>
  )
}
