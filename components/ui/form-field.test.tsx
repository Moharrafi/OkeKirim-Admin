import { describe, it, expect } from "vitest"
import React from "react"
import { FormField } from "./form-field"

describe("FormField", () => {
  it("should be a valid function component", () => {
    expect(typeof FormField).toBe("function")
  })

  it("should render label and children", () => {
    const result = FormField({
      label: "Lokasi Muat",
      children: React.createElement("input", { type: "text" }),
    })
    expect(result).toBeDefined()
    // Should render a div wrapper
    expect(result.type).toBe("div")
    // Should have children: Label, input, and optionally error
    const children = result.props.children
    expect(children).toBeDefined()
  })

  it("should not show error when touched is false", () => {
    const result = FormField({
      label: "Lokasi Muat",
      error: "Lokasi muat wajib diisi",
      touched: false,
      children: React.createElement("input", { type: "text" }),
    })
    // Children array: [Label, input, error (conditionally rendered)]
    const children = result.props.children
    // The third child (error) should be falsy when touched is false
    expect(children[2]).toBeFalsy()
  })

  it("should not show error when error is undefined even if touched", () => {
    const result = FormField({
      label: "Lokasi Muat",
      error: undefined,
      touched: true,
      children: React.createElement("input", { type: "text" }),
    })
    const children = result.props.children
    expect(children[2]).toBeFalsy()
  })

  it("should show error when both touched is true and error is present", () => {
    const result = FormField({
      label: "Lokasi Muat",
      error: "Lokasi muat wajib diisi",
      touched: true,
      children: React.createElement("input", { type: "text" }),
    })
    const children = result.props.children
    // The third child should be the error paragraph
    const errorElement = children[2]
    expect(errorElement).toBeTruthy()
    expect(errorElement.type).toBe("p")
    expect(errorElement.props.role).toBe("alert")
    expect(errorElement.props.children).toBe("Lokasi muat wajib diisi")
    // Should have destructive text color and fade-in animation classes
    expect(errorElement.props.className).toContain("text-destructive")
    expect(errorElement.props.className).toContain("animate-in")
    expect(errorElement.props.className).toContain("fade-in")
  })

  it("should clear error display when error prop becomes undefined", () => {
    // First render with error
    const withError = FormField({
      label: "Argo",
      error: "Nilai argo tidak valid",
      touched: true,
      children: React.createElement("input", { type: "text" }),
    })
    expect(withError.props.children[2]).toBeTruthy()

    // Second render without error (simulating error cleared)
    const withoutError = FormField({
      label: "Argo",
      error: undefined,
      touched: true,
      children: React.createElement("input", { type: "text" }),
    })
    expect(withoutError.props.children[2]).toBeFalsy()
  })

  it("should accept custom className", () => {
    const result = FormField({
      label: "Test",
      className: "custom-class",
      children: React.createElement("input", { type: "text" }),
    })
    expect(result.props.className).toContain("custom-class")
  })
})
