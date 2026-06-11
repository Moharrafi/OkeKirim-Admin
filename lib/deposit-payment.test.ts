import { describe, expect, it } from "vitest"
import {
  parseManualPaymentAmount,
  resolveDepositPaymentAmount,
  shouldAutoRecordPartialFromProof,
} from "./deposit-payment"

describe("deposit payment amount resolution", () => {
  it("uses proof amount as automatic partial payment when proof is lower and no manual amount is set", () => {
    expect(resolveDepositPaymentAmount({
      expectedAmount: 723000,
      proofDetectedAmount: 612000,
      tolerance: 100,
    })).toBe(612000)
  })

  it("keeps full payment when proof difference is within tolerance", () => {
    expect(resolveDepositPaymentAmount({
      expectedAmount: 723000,
      proofDetectedAmount: 722950,
      tolerance: 100,
    })).toBe(723000)
  })

  it("uses manual partial amount before OCR proof amount", () => {
    expect(resolveDepositPaymentAmount({
      expectedAmount: 723000,
      manualAmount: 500000,
      proofDetectedAmount: 612000,
      tolerance: 100,
    })).toBe(500000)
  })

  it("does not increase payment when proof amount is higher than expected", () => {
    expect(resolveDepositPaymentAmount({
      expectedAmount: 723000,
      proofDetectedAmount: 800000,
      tolerance: 100,
    })).toBe(723000)
  })

  it("detects automatic partial only when no manual amount exists", () => {
    expect(shouldAutoRecordPartialFromProof({
      expectedAmount: 723000,
      proofDetectedAmount: 612000,
      tolerance: 100,
    })).toBe(true)

    expect(shouldAutoRecordPartialFromProof({
      expectedAmount: 723000,
      manualAmount: 500000,
      proofDetectedAmount: 612000,
      tolerance: 100,
    })).toBe(false)
  })

  it("parses manual payment input safely", () => {
    expect(parseManualPaymentAmount("612000")).toBe(612000)
    expect(parseManualPaymentAmount("0")).toBe(0)
    expect(parseManualPaymentAmount("")).toBe(0)
  })
})
