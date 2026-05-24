import { describe, it, expect } from "vitest"
import { formatCurrency, parseCurrency } from "./currency"

describe("formatCurrency", () => {
  it("formats zero as '0'", () => {
    expect(formatCurrency(0)).toBe("0")
  })

  it("formats numbers below 1000 without separators", () => {
    expect(formatCurrency(500)).toBe("500")
    expect(formatCurrency(999)).toBe("999")
  })

  it("formats thousands with dot separator", () => {
    expect(formatCurrency(1000)).toBe("1.000")
    expect(formatCurrency(5000)).toBe("5.000")
    expect(formatCurrency(10000)).toBe("10.000")
  })

  it("formats millions with dot separators", () => {
    expect(formatCurrency(1500000)).toBe("1.500.000")
    expect(formatCurrency(25000000)).toBe("25.000.000")
  })

  it("formats max value 999999999", () => {
    expect(formatCurrency(999999999)).toBe("999.999.999")
  })

  it("clamps values above max to 999999999", () => {
    expect(formatCurrency(1000000000)).toBe("999.999.999")
  })

  it("handles negative numbers with minus prefix", () => {
    expect(formatCurrency(-1000)).toBe("-1.000")
    expect(formatCurrency(-1500000)).toBe("-1.500.000")
  })
})

describe("parseCurrency", () => {
  it("parses '0' to 0", () => {
    expect(parseCurrency("0")).toBe(0)
  })

  it("parses empty string to 0", () => {
    expect(parseCurrency("")).toBe(0)
  })

  it("parses formatted thousands", () => {
    expect(parseCurrency("1.000")).toBe(1000)
    expect(parseCurrency("5.000")).toBe(5000)
  })

  it("parses formatted millions", () => {
    expect(parseCurrency("1.500.000")).toBe(1500000)
    expect(parseCurrency("25.000.000")).toBe(25000000)
  })

  it("parses max value", () => {
    expect(parseCurrency("999.999.999")).toBe(999999999)
  })

  it("parses numbers without separators", () => {
    expect(parseCurrency("500")).toBe(500)
    expect(parseCurrency("1234567")).toBe(1234567)
  })

  it("parses negative formatted numbers", () => {
    expect(parseCurrency("-1.000")).toBe(-1000)
  })

  it("returns 0 for non-numeric strings", () => {
    expect(parseCurrency("abc")).toBe(0)
  })
})

describe("formatCurrency and parseCurrency round-trip", () => {
  it("round-trips correctly for typical values", () => {
    const values = [1000, 5000, 10000, 100000, 1500000, 999999999]
    for (const value of values) {
      expect(parseCurrency(formatCurrency(value))).toBe(value)
    }
  })
})
