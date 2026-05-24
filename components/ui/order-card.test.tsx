import { describe, it, expect, vi } from "vitest"
import React from "react"
import { OrderCard } from "./order-card"
import type { Order } from "@/lib/utils/orders"

const mockOrder: Order = {
  id: "ORD-001",
  driver: "Budi Santoso",
  driverId: "DRV-001",
  vehicle: "B 1234 XYZ",
  lokasiMuat: "Jakarta",
  lokasiBongkar: "Bandung",
  argo: 150000,
  companyShare: 30000,
  paidAmount: 50000,
  sisa: 70000,
  type: "online",
  date: "2025-01-15",
  time: "08:30",
  status: "pending",
}

describe("OrderCard", () => {
  it("should be a valid function component", () => {
    expect(typeof OrderCard).toBe("function")
  })

  it("should render order information", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: false,
    })
    expect(result).toBeDefined()
    // The root element is a Card
    expect(result.props["data-testid"]).toBe("order-card")
  })

  it("should apply red border when isOverdue is true", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: true,
    })
    expect(result.props.className).toContain("border-red-500")
    expect(result.props.className).toContain("border-2")
  })

  it("should not apply red border when isOverdue is false", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: false,
    })
    expect(result.props.className).not.toContain("border-red-500")
  })

  it("should apply stagger fade-in animation for index < 20", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 5,
      isOverdue: false,
    })
    expect(result.props.className).toContain("animate-stagger-fade-in")
    expect(result.props.style).toEqual({ animationDelay: "250ms" })
  })

  it("should not apply stagger animation for index >= 20", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 20,
      isOverdue: false,
    })
    expect(result.props.className).not.toContain("animate-stagger-fade-in")
    expect(result.props.style).toBeUndefined()
  })

  it("should apply correct animation delay based on index", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 3,
      isOverdue: false,
    })
    // 3 * 50ms = 150ms
    expect(result.props.style).toEqual({ animationDelay: "150ms" })
  })

  it("should have touch feedback class (active:scale-[0.98])", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: false,
    })
    expect(result.props.className).toContain("active:scale-[0.98]")
  })

  it("should have transition duration of 100ms", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: false,
    })
    expect(result.props.className).toContain("duration-100")
  })

  it("should apply selection highlight when isSelected is true", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: false,
      isSelected: true,
      onSelect: () => {},
    })
    expect(result.props.className).toContain("ring-2")
    expect(result.props.className).toContain("ring-primary")
  })

  it("should not apply selection highlight when isSelected is false", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: false,
      isSelected: false,
      onSelect: () => {},
    })
    expect(result.props.className).not.toContain("ring-2")
  })

  it("should render checkbox when onSelect is provided", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: false,
      isSelected: false,
      onSelect: () => {},
    })
    // Traverse to find the checkbox in the rendered tree
    const cardContent = result.props.children
    const contentChildren = cardContent.props.children
    // First child is the header div
    const headerDiv = contentChildren[0]
    const headerLeft = headerDiv.props.children[0]
    const checkboxElement = headerLeft.props.children[0]
    // When onSelect is provided, first element should be the Checkbox
    expect(checkboxElement).not.toBeFalsy()
  })

  it("should not render checkbox when onSelect is not provided", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: false,
    })
    const cardContent = result.props.children
    const contentChildren = cardContent.props.children
    const headerDiv = contentChildren[0]
    const headerLeft = headerDiv.props.children[0]
    const checkboxElement = headerLeft.props.children[0]
    // When onSelect is not provided, first element should be falsy
    expect(checkboxElement).toBeFalsy()
  })

  it("should set aria-selected attribute based on isSelected", () => {
    const selectedResult = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: false,
      isSelected: true,
      onSelect: () => {},
    })
    expect(selectedResult.props["aria-selected"]).toBe(true)

    const unselectedResult = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: false,
      isSelected: false,
    })
    expect(unselectedResult.props["aria-selected"]).toBe(false)
  })

  it("should display overdue badge when isOverdue is true", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: true,
    })
    // Navigate to the amount section to find the overdue badge
    const cardContent = result.props.children
    const contentChildren = cardContent.props.children
    // Last child is the amount section
    const amountSection = contentChildren[3]
    const overdueLabel = amountSection.props.children[1]
    expect(overdueLabel).toBeTruthy()
    expect(overdueLabel.props.children).toBe("Terlambat")
  })

  it("should not display overdue badge when isOverdue is false", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: false,
    })
    const cardContent = result.props.children
    const contentChildren = cardContent.props.children
    const amountSection = contentChildren[3]
    const overdueLabel = amountSection.props.children[1]
    expect(overdueLabel).toBeFalsy()
  })

  it("should have role=button for accessibility", () => {
    const result = OrderCard({
      order: mockOrder,
      index: 0,
      isOverdue: false,
    })
    expect(result.props.role).toBe("button")
    expect(result.props.tabIndex).toBe(0)
  })

  it("should display formatted sisa amount", () => {
    const result = OrderCard({
      order: { ...mockOrder, sisa: 1500000 },
      index: 0,
      isOverdue: false,
    })
    const cardContent = result.props.children
    const contentChildren = cardContent.props.children
    const amountSection = contentChildren[3]
    const amountDiv = amountSection.props.children[0]
    const amountText = amountDiv.props.children[1]
    // Should contain formatted currency "1.500.000"
    expect(amountText.props.children).toContain("1.500.000")
  })
})
