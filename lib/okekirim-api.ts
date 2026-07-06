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
  orderProof?: string | null
  lastPaidAmount?: number
}

export interface Driver {
  id: number
  name: string
  vehicle: string | null
  vehicleType: string | null
  vehicleYear: string | null
  status: string
  phone?: string | null
  email?: string | null
  address?: string | null
}

export interface HistoryResponse {
  history: Schedule[]
  count: number
  hasMore: boolean
  range?: {
    from: string | null
    to: string | null
  }
}

let cachedDrivers: Driver[] | null = null

export async function fetchDrivers(options?: { force?: boolean }): Promise<Driver[]> {
  if (!options?.force && cachedDrivers) return cachedDrivers
  if (!options?.force && typeof window !== "undefined") {
    const cached = sessionStorage.getItem("api_drivers_cache")
    if (cached) {
      try {
        cachedDrivers = JSON.parse(cached)
        return cachedDrivers!
      } catch {}
    }
  }
  try {
    const resp = await fetch("/api/drivers")
    if (!resp.ok) return []
    const data = await resp.json()
    const drivers = data.drivers || []
    cachedDrivers = drivers
    if (typeof window !== "undefined") {
      sessionStorage.setItem("api_drivers_cache", JSON.stringify(drivers))
    }
    return drivers
  } catch (err) {
    console.warn("Failed to fetch drivers:", err)
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
  const response = await fetchHistoryPage(driver, dateFrom, dateTo)
  return response.history
}

export async function fetchHistoryPage(
  driver?: string,
  dateFrom?: string,
  dateTo?: string,
  options?: {
    includePending?: boolean
    minDate?: string
    windowDays?: number
    limit?: number
  }
): Promise<HistoryResponse> {
  try {
    const params = new URLSearchParams()
    if (driver) params.set("driver", driver)
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)
    if (options?.includePending) params.set("includePending", "true")
    if (options?.minDate) params.set("minDate", options.minDate)
    if (options?.windowDays) params.set("windowDays", String(options.windowDays))
    if (options?.limit) params.set("limit", String(options.limit))

    const resp = await fetch(`/api/tarikan/history?${params.toString()}`)
    if (!resp.ok) {
      return { history: [], count: 0, hasMore: false }
    }
    const data = await resp.json()
    return {
      history: data.history || [],
      count: Number(data.count || 0),
      hasMore: Boolean(data.hasMore),
      range: data.range,
    }
  } catch (err) {
    console.warn("Failed to fetch history:", err)
    return { history: [], count: 0, hasMore: false }
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
  orderProof?: string
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
