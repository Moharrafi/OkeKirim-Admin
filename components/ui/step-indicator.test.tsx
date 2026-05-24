import { describe, it, expect } from "vitest"
import React from "react"
import { StepIndicator } from "./step-indicator"

describe("StepIndicator", () => {
  const depositSteps = ["Daftar Orderan", "Detail Setoran", "Konfirmasi"]
  const batchSteps = ["Daftar Orderan", "Pilih Orderan", "Pembayaran Batch", "Konfirmasi"]

  it("should be a valid function component", () => {
    expect(typeof StepIndicator).toBe("function")
  })

  it("should render all steps for deposit flow", () => {
    const result = StepIndicator({ steps: depositSteps, currentStep: 0 })
    expect(result).toBeDefined()
    // Each step produces a Fragment with step div + connector (except last)
    // Total children: step + connector + step + connector + step = 5 fragments
    const children = result.props.children
    expect(children.length).toBe(3)
  })

  it("should render all steps for batch flow", () => {
    const result = StepIndicator({ steps: batchSteps, currentStep: 0 })
    const children = result.props.children
    expect(children.length).toBe(4)
  })

  it("should highlight the current step with primary color classes", () => {
    const result = StepIndicator({ steps: depositSteps, currentStep: 1 })
    const children = result.props.children

    // Step at index 1 (Detail Setoran) should be active
    const activeStep = children[1]
    // The Fragment contains the step div and connector
    const stepContent = activeStep.props.children
    // First child is the step column div
    const stepColumn = stepContent[0]
    // First child of column is the circle
    const circle = stepColumn.props.children[0]
    expect(circle.props.className).toContain("border-primary")
    expect(circle.props.className).toContain("bg-primary")
  })

  it("should show checkmark for completed steps", () => {
    const result = StepIndicator({ steps: depositSteps, currentStep: 2 })
    const children = result.props.children

    // Steps 0 and 1 should be completed (show checkmark SVG)
    const completedStep = children[0]
    const stepContent = completedStep.props.children
    const stepColumn = stepContent[0]
    const circle = stepColumn.props.children[0]
    // Completed step circle should contain an SVG (checkmark)
    const circleContent = circle.props.children
    // When completed, it renders the SVG element (not a span with number)
    expect(circleContent.type).toBe("svg")
  })

  it("should show step number for future steps", () => {
    const result = StepIndicator({ steps: depositSteps, currentStep: 0 })
    const children = result.props.children

    // Step at index 2 (Konfirmasi) should be future
    const futureStep = children[2]
    const stepContent = futureStep.props.children
    const stepColumn = stepContent[0]
    const circle = stepColumn.props.children[0]
    const circleContent = circle.props.children
    // Future step shows a span with the step number
    expect(circleContent.type).toBe("span")
    expect(circleContent.props.children).toBe(3)
  })

  it("should dim future steps", () => {
    const result = StepIndicator({ steps: depositSteps, currentStep: 0 })
    const children = result.props.children

    // Step at index 1 should be future (dimmed)
    const futureStep = children[1]
    const stepContent = futureStep.props.children
    const stepColumn = stepContent[0]
    const circle = stepColumn.props.children[0]
    expect(circle.props.className).toContain("muted")
  })

  it("should render connector lines between steps", () => {
    const result = StepIndicator({ steps: depositSteps, currentStep: 1 })
    const children = result.props.children

    // First step (completed) should have a connector after it
    const firstStep = children[0]
    const stepContent = firstStep.props.children
    // Second element in Fragment is the connector
    const connector = stepContent[1]
    expect(connector).not.toBeNull()
    // Connector for completed step should have primary color
    expect(connector.props.className).toContain("bg-primary")
  })

  it("should not render connector after the last step", () => {
    const result = StepIndicator({ steps: depositSteps, currentStep: 0 })
    const children = result.props.children

    // Last step should not have a connector
    const lastStep = children[2]
    const stepContent = lastStep.props.children
    const connector = stepContent[1]
    // Connector should be false/null for last step
    expect(connector).toBeFalsy()
  })

  it("should render step labels", () => {
    const result = StepIndicator({ steps: depositSteps, currentStep: 0 })
    const children = result.props.children

    // Check first step label
    const firstStep = children[0]
    const stepContent = firstStep.props.children
    const stepColumn = stepContent[0]
    // Second child of column is the label span
    const label = stepColumn.props.children[1]
    expect(label.props.children).toBe("Daftar Orderan")
  })
})
