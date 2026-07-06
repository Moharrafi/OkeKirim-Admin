import { describe, expect, it } from "vitest"
import {
  extractTransferRecipient,
  normalizeRecipientText,
  recipientSimilarity,
  REQUIRED_TRANSFER_RECIPIENT,
} from "./ocr-recipient"

describe("OCR Recipient Matching", () => {
  it("normalizes recipient text and cleans up common OCR typos", () => {
    expect(normalizeRecipientText("cite vebby liahy")).toBe("GITAVEBBYILLAHY")
    expect(normalizeRecipientText("GITA VEBBY ILLAHY")).toBe("GITAVEBBYILLAHY")
    expect(normalizeRecipientText("clte vebby ilahy")).toBe("GITAVEBBYILLAHY")
    expect(normalizeRecipientText("ita vebby iliahy")).toBe("GITAVEBBYILLAHY")
  })

  it("calculates similarity correctly for the user's specific case", () => {
    const candidate1 = "Ke © cite vebby liahy"
    const score1 = recipientSimilarity(candidate1)
    expect(score1).toBeGreaterThanOrEqual(0.70)

    const candidate2 = "Ke © ita Vebby Iliahy"
    const score2 = recipientSimilarity(candidate2)
    expect(score2).toBeGreaterThanOrEqual(0.70)
  })

  it("extracts recipient correctly and matches the user's OCR text", () => {
    const ocrText1 = `
Ke
© cite vebby liahy
BCA: 4061373823
Jumlah Transfer
Rp 280.000
    `
    const result1 = extractTransferRecipient(ocrText1)
    expect(result1.matched).toBe(true)
    expect(result1.detectedName).toContain("cite vebby liahy")

    const ocrText2 = `
Ke
© ita Vebby Iliahy
BCA: 4061373823
Jumlah Transfer
Rp 280.000
    `
    const result2 = extractTransferRecipient(ocrText2)
    expect(result2.matched).toBe(true)
    expect(result2.detectedName).toContain("ita Vebby Iliahy")
  })

  it("rejects non-matching names", () => {
    const results = [
      extractTransferRecipient("Muhammad Ibnu Fajar M"),
      extractTransferRecipient("Gita Syafira"),
      extractTransferRecipient("Vebby Anggraini"),
      extractTransferRecipient("Gita Vebby"), // missing "Illahy"
    ]

    for (const result of results) {
      expect(result.matched).toBe(false)
    }
  })
})
