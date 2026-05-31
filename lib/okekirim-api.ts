export interface Schedule {
  id: number
  driver: string | null
  vehicle: string | null
  driverVehicle?: string | null
  date: string | null
  origin: string | null
  destination: string | null
  rit: string | null
  orderType: string
  fare: number
  status: string
  companyShare: number
  paidCompanyAmount: number
  notes: string | null
  payment_notes: string | null
  paymentNotes?: string | null
  lastPaidAt: string | null
  paidOffAt: string | null
  created_at: string | null
}

export interface Driver {
  id: number
  name: string
  vehicle: string | null
  vehicleType: string | null
  vehicleYear: string | null
  status: string
}

export async function fetchDrivers(): Promise<Driver[]> {
  try {
    const resp = await fetch("/api/drivers")
    if (!resp.ok) return []
    const data = await resp.json()
    return data.drivers || []
  } catch {
    return []
  }
}

export async function fetchSchedules(
  filter?: "pending" | "paid" | "all",
  driver?: string,
  options?: { page?: number; limit?: number }
): Promise<Schedule[]> {
  try {
    const params = new URLSearchParams()
    if (filter) params.set("filter", filter)
    if (driver) params.set("driver", driver)
    if (options?.page) params.set("page", String(options.page))
    if (options?.limit) params.set("limit", String(options.limit))

    const resp = await fetch(`/api/tarikan?${params.toString()}`)
    if (!resp.ok) return []
    const data = await resp.json()
    return data.schedules || []
  } catch (err) {
    console.warn("Failed to fetch schedules:", err)
    return []
  }
}

export async function fetchPendingSchedules(driverName?: string): Promise<Schedule[]> {
  return fetchSchedules("pending", driverName)
}

export async function fetchPaidSchedules(driverName?: string): Promise<Schedule[]> {
  return fetchSchedules("paid", driverName)
}

export async function fetchHistory(driver?: string, dateFrom?: string, dateTo?: string): Promise<Schedule[]> {
  try {
    const params = new URLSearchParams()
    if (driver) params.set("driver", driver)
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)

    const resp = await fetch(`/api/tarikan/history?${params.toString()}`)
    if (!resp.ok) return []
    const data = await resp.json()
    return data.history || []
  } catch (err) {
    console.warn("Failed to fetch history:", err)
    return []
  }
}

export async function createOrder(order: {
  driver: string
  vehicle?: string
  date?: string
  origin: string
  destination: string
  rit?: string
  orderType: string
  fare: number
  notes?: string
}, options?: { signal?: AbortSignal }): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const resp = await fetch("/api/tarikan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
      signal: options?.signal,
    })
    const data = await resp.json()
    if (!resp.ok) return { success: false, error: data.error }
    return { success: true, id: data.id }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, error: "AbortError" }
    }
    return { success: false, error: String(err) }
  }
}
