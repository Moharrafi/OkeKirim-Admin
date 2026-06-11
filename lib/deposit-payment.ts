export const DEFAULT_PAYMENT_AMOUNT_TOLERANCE = 100

export function parseManualPaymentAmount(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value || ""), 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

function normalizeAmount(value: number | null | undefined) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Math.floor(Number(value)) : 0
}

interface DepositPaymentAmountOptions {
  expectedAmount: number
  manualAmount?: number
  proofDetectedAmount?: number | null
  tolerance?: number
}

export function shouldAutoRecordPartialFromProof({
  expectedAmount,
  manualAmount = 0,
  proofDetectedAmount,
  tolerance = DEFAULT_PAYMENT_AMOUNT_TOLERANCE,
}: DepositPaymentAmountOptions) {
  const expected = normalizeAmount(expectedAmount)
  const manual = normalizeAmount(manualAmount)
  const proof = normalizeAmount(proofDetectedAmount)

  return manual <= 0 && expected > 0 && proof > 0 && expected - proof > tolerance
}

export function resolveDepositPaymentAmount(options: DepositPaymentAmountOptions) {
  const expected = normalizeAmount(options.expectedAmount)
  const manual = normalizeAmount(options.manualAmount)

  if (manual > 0) {
    return expected > 0 ? Math.min(manual, expected) : manual
  }

  if (shouldAutoRecordPartialFromProof(options)) {
    return Math.min(normalizeAmount(options.proofDetectedAmount), expected)
  }

  return expected
}
