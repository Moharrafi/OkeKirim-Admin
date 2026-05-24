import { describe, it, expect } from "vitest"
import React from "react"
import { SkeletonOrderList } from "./skeleton-order-list"

describe("SkeletonOrderList", () => {
  it("should accept count prop with default value of 3", () => {
    // Verify the component is a valid function component
    expect(typeof SkeletonOrderList).toBe("function")

    // Verify default props behavior by calling with no props
    const defaultResult = SkeletonOrderList({})
    expect(defaultResult).toBeDefined()
    // Default renders 3 skeleton cards
    expect(defaultResult.props.children.length).toBe(3)
  })

  it("should render the specified number of skeleton cards", () => {
    const result = SkeletonOrderList({ count: 5 })
    expect(result.props.children.length).toBe(5)
  })

  it("should render 1 skeleton card when count is 1", () => {
    const result = SkeletonOrderList({ count: 1 })
    expect(result.props.children.length).toBe(1)
  })

  it("should render 0 skeleton cards when count is 0", () => {
    const result = SkeletonOrderList({ count: 0 })
    expect(result.props.children.length).toBe(0)
  })
})
