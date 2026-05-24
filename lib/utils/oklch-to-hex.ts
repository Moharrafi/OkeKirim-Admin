/**
 * Converts oklch color values to hex (#RRGGBB) format.
 * Used for WCAG contrast ratio verification of theme colors.
 *
 * oklch(L C H) where:
 * - L: Lightness (0 to 1)
 * - C: Chroma (0 to ~0.4)
 * - H: Hue (0 to 360 degrees)
 *
 * Conversion path: oklch → oklab → linear sRGB → sRGB → hex
 */

/**
 * Parses an oklch() CSS string into its components.
 * Supports formats: "oklch(L C H)" or "oklch(L C H / alpha)"
 */
export function parseOklch(oklchStr: string): { l: number; c: number; h: number } {
  const match = oklchStr.match(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*[\d.]+)?\s*\)/
  )
  if (!match) {
    throw new Error(`Invalid oklch format: "${oklchStr}"`)
  }
  return {
    l: parseFloat(match[1]),
    c: parseFloat(match[2]),
    h: parseFloat(match[3]),
  }
}

/**
 * Converts oklab (L, a, b) to linear sRGB.
 */
function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  // oklab to LMS (approximate cube roots)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  // LMS to linear sRGB
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bOut = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

  return [r, g, bOut]
}

/**
 * Converts oklch to oklab.
 */
function oklchToOklab(l: number, c: number, h: number): [number, number, number] {
  const hRad = (h * Math.PI) / 180
  const a = c * Math.cos(hRad)
  const b = c * Math.sin(hRad)
  return [l, a, b]
}

/**
 * Applies sRGB gamma (transfer function) to a linear value.
 */
function linearToSrgb(value: number): number {
  if (value <= 0.0031308) {
    return 12.92 * value
  }
  return 1.055 * Math.pow(value, 1 / 2.4) - 0.055
}

/**
 * Clamps a value between 0 and 1.
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * Converts an oklch color string to a hex color string (#RRGGBB).
 */
export function oklchToHex(oklchStr: string): string {
  const { l, c, h } = parseOklch(oklchStr)

  // Handle achromatic colors (c = 0)
  const [labL, labA, labB] = c === 0 ? [l, 0, 0] : oklchToOklab(l, c, h)

  const [linearR, linearG, linearB] = oklabToLinearSrgb(labL, labA, labB)

  // Apply gamma and clamp
  const r = Math.round(clamp01(linearToSrgb(linearR)) * 255)
  const g = Math.round(clamp01(linearToSrgb(linearG)) * 255)
  const b = Math.round(clamp01(linearToSrgb(linearB)) * 255)

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}
