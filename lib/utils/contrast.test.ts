import { describe, it, expect } from "vitest"
import { calculateContrastRatio, relativeLuminance } from "./contrast"

describe("relativeLuminance", () => {
  it("returns 0 for black (#000000)", () => {
    expect(relativeLuminance("#000000")).toBe(0)
  })

  it("returns 1 for white (#FFFFFF)", () => {
    expect(relativeLuminance("#FFFFFF")).toBe(1)
  })

  it("calculates luminance for pure red", () => {
    const lum = relativeLuminance("#FF0000")
    expect(lum).toBeCloseTo(0.2126, 4)
  })

  it("calculates luminance for pure green", () => {
    const lum = relativeLuminance("#00FF00")
    expect(lum).toBeCloseTo(0.7152, 4)
  })

  it("calculates luminance for pure blue", () => {
    const lum = relativeLuminance("#0000FF")
    expect(lum).toBeCloseTo(0.0722, 4)
  })

  it("throws for invalid hex format", () => {
    expect(() => relativeLuminance("#FFF")).toThrow("Invalid hex color")
    expect(() => relativeLuminance("000000")).toThrow("Invalid hex color")
    expect(() => relativeLuminance("#GGGGGG")).toThrow("non-hex characters")
  })
})

describe("calculateContrastRatio", () => {
  it("returns 21 for black vs white (maximum contrast)", () => {
    expect(calculateContrastRatio("#000000", "#FFFFFF")).toBe(21)
  })

  it("returns 1 for same color (no contrast)", () => {
    expect(calculateContrastRatio("#FF0000", "#FF0000")).toBe(1)
    expect(calculateContrastRatio("#336699", "#336699")).toBe(1)
  })

  it("is symmetric (order of colors does not matter)", () => {
    const ratio1 = calculateContrastRatio("#000000", "#FFFFFF")
    const ratio2 = calculateContrastRatio("#FFFFFF", "#000000")
    expect(ratio1).toBe(ratio2)
  })

  it("returns ratio >= 1 always", () => {
    const ratio = calculateContrastRatio("#333333", "#666666")
    expect(ratio).toBeGreaterThanOrEqual(1)
  })

  it("correctly identifies WCAG AA compliant pairs for normal text (>= 4.5:1)", () => {
    // Black on white: 21:1 - passes
    expect(calculateContrastRatio("#000000", "#FFFFFF")).toBeGreaterThanOrEqual(4.5)
    // Dark gray on white: should pass
    expect(calculateContrastRatio("#595959", "#FFFFFF")).toBeGreaterThanOrEqual(4.5)
  })

  it("correctly identifies non-compliant pairs for normal text (< 4.5:1)", () => {
    // Light gray on white: fails AA for normal text
    expect(calculateContrastRatio("#777777", "#FFFFFF")).toBeLessThan(4.5)
  })

  it("correctly identifies WCAG AA compliant pairs for large text (>= 3:1)", () => {
    // #777777 on white is ~4.48:1 - passes for large text
    expect(calculateContrastRatio("#777777", "#FFFFFF")).toBeGreaterThanOrEqual(3)
  })

  it("handles lowercase hex input", () => {
    const upper = calculateContrastRatio("#FF0000", "#FFFFFF")
    const lower = calculateContrastRatio("#ff0000", "#ffffff")
    expect(upper).toBeCloseTo(lower, 10)
  })
})
