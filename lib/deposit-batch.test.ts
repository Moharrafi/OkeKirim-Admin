import { describe, expect, it } from "vitest"
import { getBatchDepositDue, getBatchItemDepositDue } from "./deposit-batch"

describe("batch deposit due calculation", () => {
  it("uses remaining sisa before full company share", () => {
    expect(getBatchDepositDue([
      { fare: 1300000, companyShare: 520000, sisa: 520000 },
      { fare: 600000, companyShare: 240000, sisa: 240000 },
      { fare: 900000, companyShare: 360000, sisa: 20000 },
    ])).toBe(780000)
  })

  it("falls back to company share for older telegram payloads", () => {
    expect(getBatchItemDepositDue({ fare: 900000, companyShare: 360000 })).toBe(360000)
  })

  it("falls back to forty percent of fare when company share is missing", () => {
    expect(getBatchItemDepositDue({ fare: 900000 })).toBe(360000)
  })
})
