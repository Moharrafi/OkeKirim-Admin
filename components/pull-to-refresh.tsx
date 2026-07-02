"use client"

import { useState, useRef, useCallback } from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
}

export function PullToRefresh({ onRefresh, children, scrollContainerRef }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const isPulling = useRef(false)

  const THRESHOLD = 80

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const isAtTop = scrollContainerRef 
      ? (scrollContainerRef.current ? scrollContainerRef.current.scrollTop <= 0 : true)
      : window.scrollY <= 0

    if (isAtTop) {
      startY.current = e.touches[0].clientY
      isPulling.current = true
    }
  }, [scrollContainerRef])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const currentY = e.touches[0].clientY
    const diff = currentY - startY.current
    
    const isAtTop = scrollContainerRef 
      ? (scrollContainerRef.current ? scrollContainerRef.current.scrollTop <= 0 : true)
      : window.scrollY <= 0

    if (diff > 0 && isAtTop) {
      setPullDistance(Math.min(diff * 0.4, 120))
    } else {
      // User is scrolling up normally
      isPulling.current = false
      setPullDistance(0)
    }
  }, [refreshing, scrollContainerRef])

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
      className="relative h-full"
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

