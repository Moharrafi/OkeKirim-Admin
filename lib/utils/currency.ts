/**
 * Currency utility functions for Indonesian Rupiah formatting.
 * Uses dots (.) as thousand separators per Indonesian locale convention.
 */

const MAX_VALUE = 999999999

/**
 * Formats a number with Indonesian thousand separators (dots).
 * Examples:
 *   formatCurrency(1000) → "1.000"
 *   formatCurrency(1500000) → "1.500.000"
 *   formatCurrency(0) → "0"
 *
 * @param value - The numeric value to format
 * @returns Formatted string with dot thousand separators
 */
export function formatCurrency(value: number): string {
  if (value === 0) return "0"

  const clamped = Math.min(Math.abs(value), MAX_VALUE)
  const isNegative = value < 0

  const formatted = clamped
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")

  return isNegative ? `-${formatted}` : formatted
}

/**
 * Parses a formatted currency string back to a numeric value.
 * Strips dot separators and returns the numeric value.
 * Examples:
 *   parseCurrency("1.000") → 1000
 *   parseCurrency("1.500.000") → 1500000
 *   parseCurrency("0") → 0
 *   parseCurrency("") → 0
 *
 * @param formatted - The formatted currency string
 * @returns The numeric value
 */
export function parseCurrency(formatted: string): number {
  if (!formatted || formatted.trim() === "") return 0

  const cleaned = formatted.replace(/\./g, "")
  const parsed = parseInt(cleaned, 10)

  if (isNaN(parsed)) return 0

  return parsed
}
