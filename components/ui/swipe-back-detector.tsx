'use client'

import * as React from 'react'

interface SwipeBackDetectorProps {
  enabled: boolean
  onSwipeBack: () => void
  children: React.ReactNode
}

/**
 * Pure function to determine if a touch start qualifies as a left-edge touch.
 * Returns true if startX <= 20px (left edge of screen).
 */
export function isLeftEdgeTouch(startX: number): boolean {
  return startX <= 20
}

/**
 * Pure function to determine if a swipe gesture should trigger back navigation.
 * Requires: horizontal distance >= 50px AND horizontal movement is dominant over vertical.
 */
export function shouldTriggerSwipeBack(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): boolean {
  if (!isLeftEdgeTouch(startX)) return false
  const deltaX = endX - startX
  const deltaY = Math.abs(endY - startY)
  return deltaX >= 50 && deltaX > deltaY
}

function SwipeBackDetector({ enabled, onSwipeBack, children }: SwipeBackDetectorProps) {
  const touchStartX = React.useRef<number | null>(null)
  const touchStartY = React.useRef<number | null>(null)

  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return
      const touch = e.touches[0]
      if (isLeftEdgeTouch(touch.clientX)) {
        touchStartX.current = touch.clientX
        touchStartY.current = touch.clientY
      }
    },
    [enabled]
  )

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || touchStartX.current === null) return
      // Optional: could add visual feedback here in the future
    },
    [enabled]
  )

  const handleTouchEnd = React.useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || touchStartX.current === null) return

      const touch = e.changedTouches[0]
      const triggered = shouldTriggerSwipeBack(
        touchStartX.current,
        touchStartY.current ?? 0,
        touch.clientX,
        touch.clientY
      )

      if (triggered) {
        onSwipeBack()
      }

      touchStartX.current = null
      touchStartY.current = null
    },
    [enabled, onSwipeBack]
  )

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="contents"
    >
      {children}
    </div>
  )
}

export { SwipeBackDetector }
export type { SwipeBackDetectorProps }
