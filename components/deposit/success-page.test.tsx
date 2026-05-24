import { describe, it, expect, vi } from "vitest"
import React from "react"
import { SuccessPage } from "./success-page"

describe("SuccessPage", () => {
  const defaultProps = {
    driverName: "Budi Santoso",
    amount: 1500000,
    route: "Jakarta → Surabaya",
    onBack: vi.fn(),
  }

  it("should be a valid function component", () => {
    expect(typeof SuccessPage).toBe("function")
  })

  it("should render with required props", () => {
    const result = SuccessPage(defaultProps)
    expect(result).toBeDefined()
  })

  it("should display driver name", () => {
    const result = SuccessPage(defaultProps)
    const json = JSON.stringify(result)
    expect(json).toContain("Budi Santoso")
  })

  it("should display amount in Rupiah format", () => {
    const result = SuccessPage(defaultProps)
    const json = JSON.stringify(result)
    // React serializes "Rp " and "1.500.000" as separate children in an array
    expect(json).toContain("Rp ")
    expect(json).toContain("1.500.000")
  })

  it("should display route", () => {
    const result = SuccessPage(defaultProps)
    const json = JSON.stringify(result)
    expect(json).toContain("Jakarta → Surabaya")
  })

  it("should display 'Kembali ke Daftar' button", () => {
    const result = SuccessPage(defaultProps)
    const json = JSON.stringify(result)
    expect(json).toContain("Kembali ke Daftar")
  })

  it("should show batch count when batchCount is provided", () => {
    const result = SuccessPage({ ...defaultProps, batchCount: 5 })
    const json = JSON.stringify(result)
    // React serializes number and string as separate children: [5," orderan"]
    expect(json).toContain(" orderan")
    expect(json).toContain("Total Nominal")
    expect(json).toContain("Jumlah Orderan")
  })

  it("should not show batch info for single order", () => {
    const result = SuccessPage(defaultProps)
    const json = JSON.stringify(result)
    expect(json).not.toContain("Jumlah Orderan")
    expect(json).toContain("Jumlah")
  })

  it("should not show batch info when batchCount is 1", () => {
    const result = SuccessPage({ ...defaultProps, batchCount: 1 })
    const json = JSON.stringify(result)
    expect(json).not.toContain("Jumlah Orderan")
  })

  it("should include checkmark animation class", () => {
    const result = SuccessPage(defaultProps)
    const json = JSON.stringify(result)
    expect(json).toContain("animate-zoom-in")
  })

  it("should include green checkmark SVG", () => {
    const result = SuccessPage(defaultProps)
    const json = JSON.stringify(result)
    expect(json).toContain("text-green-600")
    expect(json).toContain("M5 13l4 4L19 7")
  })
})
