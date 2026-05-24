/**
 * WCAG 2.1 contrast ratio utility.
 * Calculates the contrast ratio between two colors for accessibility compliance.
 * - Normal text (< 18pt regular or < 14pt bold): minimum 4.5:1
 * - Large text (>= 18pt regular or >= 14pt bold) and UI borders: minimum 3:1
 */

/**
 * Parses a hex color string (#RRGGBB) into normalized [R, G, B] values (0–1).
 *
 * @param hex - Color in #RRGGBB format
 * @returns Tuple of [r, g, b] each in range 0–1
 */
function parseHex(hex: string): [number, number, number] {
  if (!hex.startsWith("#")) {
    throw new Error(`Invalid hex color: "${hex}". Expected format #RRGGBB.`)
  }

  const cleaned = hex.slice(1)

  if (cleaned.length !== 6) {
    throw new Error(`Invalid hex color: "${hex}". Expected format #RRGGBB.`)
  }

  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    throw new Error(`Invalid hex color: "${hex}". Contains non-hex characters.`)
  }

  return [r / 255, g / 255, b / 255]
}

/**
 * Linearizes an sRGB channel value using the sRGB transfer function.
 * Per WCAG 2.1:
 * - If value <= 0.03928: linear = value / 12.92
 * - Otherwise: linear = ((value + 0.055) / 1.055) ^ 2.4
 *
 * @param value - sRGB channel value in range 0–1
 * @returns Linearized value
 */
function linearize(value: number): number {
  if (value <= 0.03928) {
    return value / 12.92
  }
  return Math.pow((value + 0.055) / 1.055, 2.4)
}

/**
 * Calculates the relative luminance of a color per WCAG 2.1.
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * where R, G, B are the linearized sRGB values.
 *
 * @param hex - Color in #RRGGBB format
 * @returns Relative luminance value between 0 (darkest) and 1 (lightest)
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/**
 * Calculates the contrast ratio between two colors per WCAG 2.1.
 * Formula: (L1 + 0.05) / (L2 + 0.05)
 * where L1 is the relative luminance of the lighter color
 * and L2 is the relative luminance of the darker color.
 *
 * The result ranges from 1:1 (no contrast, same color) to 21:1 (max contrast, black vs white).
 *
 * @param color1 - First color in #RRGGBB format
 * @param color2 - Second color in #RRGGBB format
 * @returns Contrast ratio (always >= 1)
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const l1 = relativeLuminance(color1)
  const l2 = relativeLuminance(color2)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}
