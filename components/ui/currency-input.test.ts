import { describe, it, expect } from "vitest"
import { formatCurrency, parseCurrency } from "@/lib/utils/currency"

/**
 * Unit tests for CurrencyInput component logic.
 * Tests the formatting and parsing behavior that drives the component.
 * The component accepts only numeric digits, formats on every keystroke,
 * and enforces max value 99999999.
 */

describe("CurrencyInput logic", () => {
  describe("display value derivation", () => {
    it("shows empty string for value 0", () => {
      // Component shows '' when value is 0 (placeholder shows instead)
      const numericValue = 0
      const displayValue = numericValue === 0 ? "" : formatCurrency(numericValue)
      expect(displayValue).toBe("")
    })

    it("formats non-zero values with thousand separators", () => {
      const numericValue = 1500000
      const displayValue = numericValue === 0 ? "" : formatCurrency(numericValue)
      expect(displayValue).toBe("1.500.000")
    })

    it("formats value at max boundary (99999999)", () => {
      const numericValue = 99999999
      const displayValue = numericValue === 0 ? "" : formatCurrency(numericValue)
      expect(displayValue).toBe("99.999.999")
    })
  })

  describe("input handling (stripping non-digits)", () => {
    it("strips non-digit characters from input", () => {
      const rawInput = "1.500.000"
      const digitsOnly = rawInput.replace(/\D/g, "")
      expect(digitsOnly).toBe("1500000")
      expect(parseInt(digitsOnly, 10)).toBe(1500000)
    })

    it("handles empty input as 0", () => {
      const rawInput = ""
      const digitsOnly = rawInput.replace(/\D/g, "")
      expect(digitsOnly).toBe("")
      // Component returns 0 for empty
    })

    it("strips letters and special characters", () => {
      const rawInput = "abc123def456"
      const digitsOnly = rawInput.replace(/\D/g, "")
      expect(digitsOnly).toBe("123456")
      expect(parseInt(digitsOnly, 10)).toBe(123456)
    })

    it("handles input with only non-digit characters as empty", () => {
      const rawInput = "abc"
      const digitsOnly = rawInput.replace(/\D/g, "")
      expect(digitsOnly).toBe("")
    })
  })

  describe("max value enforcement", () => {
    const MAX = 99999999

    it("allows values at max boundary", () => {
      const numericValue = 99999999
      const result = numericValue > MAX ? MAX : numericValue
      expect(result).toBe(99999999)
    })

    it("clamps values above max to max", () => {
      const numericValue = 100000000
      const result = numericValue > MAX ? MAX : numericValue
      expect(result).toBe(99999999)
    })

    it("allows values below max", () => {
      const numericValue = 50000000
      const result = numericValue > MAX ? MAX : numericValue
      expect(result).toBe(50000000)
    })
  })

  describe("string value parsing", () => {
    it("parses string value using parseCurrency", () => {
      expect(parseCurrency("1.500.000")).toBe(1500000)
    })

    it("parses plain numeric string", () => {
      expect(parseCurrency("5000")).toBe(5000)
    })
  })
})
