/**
 * Determines whether a touch gesture qualifies as a "swipe back" gesture.
 *
 * A swipe back is detected when:
 * - The touch starts within 20px of the left edge (startX <= 20)
 * - The horizontal swipe distance is at least 50px
 * - The horizontal movement is dominant over vertical movement
 */
export function shouldTriggerSwipeBack(
  startX: number,
  endX: number,
  startY: number,
  endY: number
): boolean {
  if (startX > 20) return false

  const deltaX = endX - startX
  const deltaY = Math.abs(endY - startY)

  return deltaX >= 50 && deltaX > deltaY
}

/**
 * Checks if a touch start position is within the swipe-back activation zone
 * (left edge, within 20px).
 */
export function isInSwipeZone(startX: number): boolean {
  return startX <= 20
}
