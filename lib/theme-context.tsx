"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"

type Theme = "light" | "dark"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/**
 * Apply theme to the DOM immediately (synchronous).
 * Adds/removes the `.dark` class on <html> and persists to localStorage.
 * This ensures all visible elements — including portaled modals, overlays,
 * and toasts — respond within a single frame (< 100ms).
 */
function applyTheme(newTheme: Theme) {
  // Synchronously update the DOM class on <html>
  if (newTheme === "dark") {
    document.documentElement.classList.add("dark")
  } else {
    document.documentElement.classList.remove("dark")
  }

  // Persist to localStorage
  try {
    localStorage.setItem("theme", newTheme)
  } catch {
    // localStorage may be unavailable (e.g. private browsing quota exceeded)
  }
}

/**
 * Read the stored theme from localStorage.
 * Returns "light" as default if unavailable or invalid.
 */
function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme")
    if (stored === "dark" || stored === "light") {
      return stored
    }
  } catch {
    // localStorage unavailable
  }
  return "light"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // On mount, read the stored theme and sync React state.
    // The inline <script> in layout.tsx already applied the class before paint,
    // so we just need to sync the React state here.
    const storedTheme = getStoredTheme()
    setThemeState(storedTheme)
    // Ensure DOM is in sync (in case inline script didn't run)
    applyTheme(storedTheme)
    setMounted(true)
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    // Apply DOM change synchronously FIRST for immediate visual feedback (< 100ms)
    applyTheme(newTheme)
    // Then update React state to keep context consumers in sync
    setThemeState(newTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const newTheme = current === "light" ? "dark" : "light"
      // Apply DOM change synchronously for immediate visual feedback
      applyTheme(newTheme)
      return newTheme
    })
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
