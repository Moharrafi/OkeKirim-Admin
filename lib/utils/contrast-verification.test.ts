/**
 * WCAG 2.1 AA Contrast Ratio Verification Test
 *
 * Verifies all text/background color pairs in both light and dark themes
 * defined in app/globals.css meet WCAG 2.1 AA compliance:
 * - Normal text (< 18pt regular or < 14pt bold): >= 4.5:1
 * - Large text (>= 18pt regular or >= 14pt bold) and UI borders: >= 3:1
 *
 * Feature: ui-ux-improvement, Task 6.4
 * Validates: Requirements 7.3, 7.4
 */

import { describe, it, expect } from "vitest"
import { calculateContrastRatio } from "./contrast"
import { oklchToHex } from "./oklch-to-hex"

// ============================================================
// Theme color definitions from app/globals.css (oklch format)
// ============================================================

const lightTheme = {
  background: "oklch(0.96 0.002 260)",
  foreground: "oklch(0.15 0.01 260)",
  card: "oklch(1 0 0)",
  "card-foreground": "oklch(0.15 0.01 260)",
  popover: "oklch(1 0 0)",
  "popover-foreground": "oklch(0.15 0.01 260)",
  primary: "oklch(0.45 0.18 165)",
  "primary-foreground": "oklch(1 0 0)",
  secondary: "oklch(0.94 0.01 260)",
  "secondary-foreground": "oklch(0.15 0.01 260)",
  muted: "oklch(0.94 0.005 260)",
  "muted-foreground": "oklch(0.45 0 0)",
  accent: "oklch(0.45 0.18 165)",
  "accent-foreground": "oklch(1 0 0)",
  destructive: "oklch(0.55 0.22 25)",
  "destructive-foreground": "oklch(1 0 0)",
  border: "oklch(0.6 0.01 260)",
  input: "oklch(0.94 0.01 260)",
  success: "oklch(0.45 0.18 145)",
  "success-foreground": "oklch(1 0 0)",
  warning: "oklch(0.7 0.18 85)",
  "warning-foreground": "oklch(0.15 0.01 260)",
  "toast-bg": "oklch(1 0 0)",
  "toast-foreground": "oklch(0.15 0.01 260)",
}

const darkTheme = {
  background: "oklch(0.14 0.005 260)",
  foreground: "oklch(0.96 0 0)",
  card: "oklch(0.19 0.005 260)",
  "card-foreground": "oklch(0.96 0 0)",
  popover: "oklch(0.19 0.005 260)",
  "popover-foreground": "oklch(0.96 0 0)",
  primary: "oklch(0.72 0.19 165)",
  "primary-foreground": "oklch(0.08 0.01 260)",
  secondary: "oklch(0.24 0.005 260)",
  "secondary-foreground": "oklch(0.96 0 0)",
  muted: "oklch(0.27 0.005 260)",
  "muted-foreground": "oklch(0.65 0 0)",
  accent: "oklch(0.72 0.19 165)",
  "accent-foreground": "oklch(0.08 0.01 260)",
  destructive: "oklch(0.55 0.2 25)",
  "destructive-foreground": "oklch(1 0 0)",
  border: "oklch(0.53 0.005 260)",
  input: "oklch(0.24 0.005 260)",
  success: "oklch(0.72 0.2 145)",
  "success-foreground": "oklch(0.08 0.01 260)",
  warning: "oklch(0.8 0.16 85)",
  "warning-foreground": "oklch(0.15 0.01 260)",
  "toast-bg": "oklch(0.22 0.005 260)",
  "toast-foreground": "oklch(0.96 0 0)",
}

// ============================================================
// Helper to convert theme to hex
// ============================================================

function themeToHex(theme: Record<string, string>): Record<string, string> {
  const hex: Record<string, string> = {}
  for (const [key, value] of Object.entries(theme)) {
    hex[key] = oklchToHex(value)
  }
  return hex
}

// ============================================================
// Color pair definitions for verification
// ============================================================

interface ColorPair {
  name: string
  foreground: string
  background: string
  /** "normal" requires >= 4.5:1, "large" requires >= 3:1 */
  textSize: "normal" | "large"
}

function getColorPairs(theme: Record<string, string>): ColorPair[] {
  return [
    // Normal text pairs (>= 4.5:1 required)
    { name: "foreground on background", foreground: theme.foreground, background: theme.background, textSize: "normal" },
    { name: "card-foreground on card", foreground: theme["card-foreground"], background: theme.card, textSize: "normal" },
    { name: "popover-foreground on popover", foreground: theme["popover-foreground"], background: theme.popover, textSize: "normal" },
    { name: "muted-foreground on background", foreground: theme["muted-foreground"], background: theme.background, textSize: "normal" },
    { name: "muted-foreground on card", foreground: theme["muted-foreground"], background: theme.card, textSize: "normal" },
    { name: "primary-foreground on primary", foreground: theme["primary-foreground"], background: theme.primary, textSize: "normal" },
    { name: "accent-foreground on accent", foreground: theme["accent-foreground"], background: theme.accent, textSize: "normal" },
    { name: "destructive-foreground on destructive", foreground: theme["destructive-foreground"], background: theme.destructive, textSize: "normal" },
    { name: "secondary-foreground on secondary", foreground: theme["secondary-foreground"], background: theme.secondary, textSize: "normal" },
    { name: "success-foreground on success", foreground: theme["success-foreground"], background: theme.success, textSize: "normal" },
    { name: "warning-foreground on warning", foreground: theme["warning-foreground"], background: theme.warning, textSize: "normal" },
    { name: "toast-foreground on toast-bg", foreground: theme["toast-foreground"], background: theme["toast-bg"], textSize: "normal" },

    // Large text / UI border pairs (>= 3:1 required)
    { name: "border on background (UI border)", foreground: theme.border, background: theme.background, textSize: "large" },
    { name: "border on card (UI border)", foreground: theme.border, background: theme.card, textSize: "large" },
    { name: "input border on background (dark mode input)", foreground: theme.border, background: theme.input, textSize: "large" },
  ]
}

// ============================================================
// Tests
// ============================================================

describe("WCAG 2.1 AA Contrast Ratio Verification", () => {
  describe("oklch to hex conversion sanity checks", () => {
    it("converts pure white oklch(1 0 0) to #ffffff", () => {
      const hex = oklchToHex("oklch(1 0 0)")
      expect(hex).toBe("#ffffff")
    })

    it("converts near-black oklch(0 0 0) to #000000", () => {
      const hex = oklchToHex("oklch(0 0 0)")
      expect(hex).toBe("#000000")
    })

    it("converts mid-gray oklch(0.5 0 0) to a mid-gray hex", () => {
      const hex = oklchToHex("oklch(0.5 0 0)")
      // oklch 0.5 lightness should be around #3b3b3b to #404040 range
      const r = parseInt(hex.slice(1, 3), 16)
      expect(r).toBeGreaterThan(50)
      expect(r).toBeLessThan(130)
    })
  })

  describe("Light Theme - Normal Text (>= 4.5:1)", () => {
    const hexTheme = themeToHex(lightTheme)
    const pairs = getColorPairs(hexTheme).filter((p) => p.textSize === "normal")

    pairs.forEach((pair) => {
      it(`${pair.name} has contrast ratio >= 4.5:1`, () => {
        const ratio = calculateContrastRatio(pair.foreground, pair.background)
        expect(ratio).toBeGreaterThanOrEqual(4.5)
      })
    })
  })

  describe("Light Theme - Large Text & UI Borders (>= 3:1)", () => {
    const hexTheme = themeToHex(lightTheme)
    const pairs = getColorPairs(hexTheme).filter((p) => p.textSize === "large")

    pairs.forEach((pair) => {
      it(`${pair.name} has contrast ratio >= 3:1`, () => {
        const ratio = calculateContrastRatio(pair.foreground, pair.background)
        expect(ratio).toBeGreaterThanOrEqual(3)
      })
    })
  })

  describe("Dark Theme - Normal Text (>= 4.5:1)", () => {
    const hexTheme = themeToHex(darkTheme)
    const pairs = getColorPairs(hexTheme).filter((p) => p.textSize === "normal")

    pairs.forEach((pair) => {
      it(`${pair.name} has contrast ratio >= 4.5:1`, () => {
        const ratio = calculateContrastRatio(pair.foreground, pair.background)
        expect(ratio).toBeGreaterThanOrEqual(4.5)
      })
    })
  })

  describe("Dark Theme - Large Text & UI Borders (>= 3:1)", () => {
    const hexTheme = themeToHex(darkTheme)
    const pairs = getColorPairs(hexTheme).filter((p) => p.textSize === "large")

    pairs.forEach((pair) => {
      it(`${pair.name} has contrast ratio >= 3:1`, () => {
        const ratio = calculateContrastRatio(pair.foreground, pair.background)
        expect(ratio).toBeGreaterThanOrEqual(3)
      })
    })
  })

  describe("Dark Theme - Input border contrast (Requirement 7.4)", () => {
    it("dark mode input border has >= 3:1 contrast against dark background", () => {
      const borderHex = oklchToHex(darkTheme.border)
      const bgHex = oklchToHex(darkTheme.background)
      const ratio = calculateContrastRatio(borderHex, bgHex)
      expect(ratio).toBeGreaterThanOrEqual(3)
    })

    it("dark mode input border has >= 3:1 contrast against input background", () => {
      const borderHex = oklchToHex(darkTheme.border)
      const inputHex = oklchToHex(darkTheme.input)
      const ratio = calculateContrastRatio(borderHex, inputHex)
      expect(ratio).toBeGreaterThanOrEqual(3)
    })
  })

  describe("Contrast ratio documentation (informational)", () => {
    it("documents all light theme contrast ratios", () => {
      const hexTheme = themeToHex(lightTheme)
      const pairs = getColorPairs(hexTheme)
      const results: Array<{ name: string; ratio: string; required: string; pass: boolean }> = []

      pairs.forEach((pair) => {
        const ratio = calculateContrastRatio(pair.foreground, pair.background)
        const required = pair.textSize === "normal" ? 4.5 : 3
        results.push({
          name: pair.name,
          ratio: ratio.toFixed(2) + ":1",
          required: required + ":1",
          pass: ratio >= required,
        })
      })

      // Log for documentation purposes
      console.table(results)
      // All should pass
      results.forEach((r) => {
        expect(r.pass).toBe(true)
      })
    })

    it("documents all dark theme contrast ratios", () => {
      const hexTheme = themeToHex(darkTheme)
      const pairs = getColorPairs(hexTheme)
      const results: Array<{ name: string; ratio: string; required: string; pass: boolean }> = []

      pairs.forEach((pair) => {
        const ratio = calculateContrastRatio(pair.foreground, pair.background)
        const required = pair.textSize === "normal" ? 4.5 : 3
        results.push({
          name: pair.name,
          ratio: ratio.toFixed(2) + ":1",
          required: required + ":1",
          pass: ratio >= required,
        })
      })

      // Log for documentation purposes
      console.table(results)
      // All should pass
      results.forEach((r) => {
        expect(r.pass).toBe(true)
      })
    })
  })
})
