"use client"

import { useState, useRef, useCallback } from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const THRESHOLD = 80

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY
      setPulling(true)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return
    const currentY = e.touches[0].clientY
    const diff = currentY - startY.current
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 120))
    }
  }, [pulling, refreshing])

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true)
      setPullDistance(THRESHOLD)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
      }
    }
    setPullDistance(0)
    setPulling(false)
  }, [pullDistance, refreshing, onRefresh])

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative overflow-auto"
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center transition-all duration-200 z-10",
          pullDistance > 0 || refreshing ? "opacity-100" : "opacity-0"
        )}
        style={{ top: -40 + (pullDistance > 0 ? pullDistance : refreshing ? THRESHOLD : 0), height: 40 }}
      >
        <RefreshCw
          className={cn(
            "h-5 w-5 text-primary transition-transform",
            refreshing && "animate-spin",
            pullDistance >= THRESHOLD && !refreshing && "text-success"
          )}
          style={{ transform: refreshing ? undefined : `rotate(${pullDistance * 2}deg)` }}
        />
      </div>

      {/* Content with pull offset */}
      <div
        className="transition-transform duration-200"
        style={{ transform: `translateY(${pullDistance > 0 ? pullDistance : refreshing ? THRESHOLD : 0}px)` }}
      >
        {children}
      </div>
    </div>
  )
}
