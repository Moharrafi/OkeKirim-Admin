export interface BatchDepositItem {
  fare?: number | string | null
  companyShare?: number | string | null
  sisa?: number | string | null
  remaining?: number | string | null
  remainingCompanyShare?: number | string | null
}

function finiteAmount(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

export function getBatchItemDepositDue(item: BatchDepositItem) {
  const explicitRemaining = finiteAmount(item.sisa ?? item.remaining ?? item.remainingCompanyShare)
  if (explicitRemaining !== null) {
    return Math.max(Math.floor(explicitRemaining), 0)
  }

  const companyShare = finiteAmount(item.companyShare)
  if (companyShare !== null) {
    return Math.max(Math.floor(companyShare), 0)
  }

  const fare = finiteAmount(item.fare) || 0
  return Math.max(Math.round(fare * 0.4), 0)
}

export function getBatchDepositDue(items: BatchDepositItem[]) {
  return items.reduce((sum, item) => sum + getBatchItemDepositDue(item), 0)
}
