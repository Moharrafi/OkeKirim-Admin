"use client"

import { useEffect, useRef, useCallback } from "react"

/**
 * Custom hook that detects mobile keyboard appearance and scrolls
 * the active input into view within 300ms.
 *
 * Uses the Visual Viewport API when available, with a fallback
 * to window resize events for older browsers.
 *
 * Requirements: 5.5 - When keyboard appears on mobile, scroll content
 * so the active field is not obscured by the keyboard.
 */
export function useKeyboardViewport() {
  const initialViewportHeight = useRef<number>(0)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scrollActiveInputIntoView = useCallback(() => {
    // Clear any pending scroll to avoid duplicate scrolls
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    scrollTimeoutRef.current = setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement | null
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "SELECT" ||
          activeElement.isContentEditable)
      ) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        })
      }
      scrollTimeoutRef.current = null
    }, 100) // Small delay to let the viewport settle, total under 300ms
  }, [])

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return

    initialViewportHeight.current = window.innerHeight

    const visualViewport = window.visualViewport

    if (visualViewport) {
      // Use Visual Viewport API (preferred, more accurate)
      const handleViewportResize = () => {
        const currentHeight = visualViewport.height
        const heightDiff = initialViewportHeight.current - currentHeight

        // If viewport shrunk significantly (keyboard likely appeared)
        if (heightDiff > 100) {
          scrollActiveInputIntoView()
        }
      }

      visualViewport.addEventListener("resize", handleViewportResize)

      return () => {
        visualViewport.removeEventListener("resize", handleViewportResize)
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
      }
    } else {
      // Fallback: use window resize event
      const handleWindowResize = () => {
        const currentHeight = window.innerHeight
        const heightDiff = initialViewportHeight.current - currentHeight

        // If window shrunk significantly (keyboard likely appeared)
        if (heightDiff > 100) {
          scrollActiveInputIntoView()
        } else if (heightDiff < 50) {
          // Keyboard likely dismissed, update reference height
          initialViewportHeight.current = currentHeight
        }
      }

      window.addEventListener("resize", handleWindowResize)

      return () => {
        window.removeEventListener("resize", handleWindowResize)
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
      }
    }
  }, [scrollActiveInputIntoView])
}
