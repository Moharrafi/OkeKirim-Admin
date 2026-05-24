import { describe, it, expect } from "vitest"
import {
  SwipeBackDetector,
  isLeftEdgeTouch,
  shouldTriggerSwipeBack,
} from "./swipe-back-detector"

describe("SwipeBackDetector", () => {
  it("should be a valid function component", () => {
    expect(typeof SwipeBackDetector).toBe("function")
  })

  describe("isLeftEdgeTouch", () => {
    it("should return true when startX <= 20", () => {
      expect(isLeftEdgeTouch(0)).toBe(true)
      expect(isLeftEdgeTouch(10)).toBe(true)
      expect(isLeftEdgeTouch(20)).toBe(true)
    })

    it("should return false when startX > 20", () => {
      expect(isLeftEdgeTouch(21)).toBe(false)
      expect(isLeftEdgeTouch(50)).toBe(false)
      expect(isLeftEdgeTouch(100)).toBe(false)
    })
  })

  describe("shouldTriggerSwipeBack", () => {
    it("should trigger when startX <= 20 and horizontal distance >= 50", () => {
      // startX=10, startY=100, endX=70, endY=105 → deltaX=60, deltaY=5
      expect(shouldTriggerSwipeBack(10, 100, 70, 105)).toBe(true)
    })

    it("should trigger at exact boundary: startX=20, distance=50", () => {
      // startX=20, startY=100, endX=70, endY=100 → deltaX=50, deltaY=0
      expect(shouldTriggerSwipeBack(20, 100, 70, 100)).toBe(true)
    })

    it("should NOT trigger when startX > 20", () => {
      // startX=25, distance would be 55 but start is not at edge
      expect(shouldTriggerSwipeBack(25, 100, 80, 100)).toBe(false)
    })

    it("should NOT trigger when horizontal distance < 50", () => {
      // startX=5, endX=45 → deltaX=40 (< 50)
      expect(shouldTriggerSwipeBack(5, 100, 45, 100)).toBe(false)
    })

    it("should NOT trigger when vertical movement exceeds horizontal", () => {
      // startX=10, endX=70 → deltaX=60, but deltaY=80 (vertical dominant)
      expect(shouldTriggerSwipeBack(10, 100, 70, 180)).toBe(false)
    })

    it("should NOT trigger for leftward swipe (negative deltaX)", () => {
      // startX=10, endX=5 → deltaX=-5 (swiping left, not right)
      expect(shouldTriggerSwipeBack(10, 100, 5, 100)).toBe(false)
    })

    it("should trigger when deltaX equals deltaY (horizontal not strictly dominant)", () => {
      // startX=10, endX=70 → deltaX=60, deltaY=60 → deltaX > deltaY is false
      expect(shouldTriggerSwipeBack(10, 100, 70, 160)).toBe(false)
    })

    it("should handle startX=0 (very edge of screen)", () => {
      expect(shouldTriggerSwipeBack(0, 200, 60, 200)).toBe(true)
    })

    it("should handle vertical movement in negative direction", () => {
      // startY=200, endY=150 → deltaY=50, deltaX=60 → horizontal dominant
      expect(shouldTriggerSwipeBack(10, 200, 70, 150)).toBe(true)
    })
  })
})
