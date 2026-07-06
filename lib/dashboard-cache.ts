// Map-based cache to store dashboard query results for different filters concurrently (TTL: 30 seconds)
export const dashboardCache = new Map<string, { data: any; timestamp: number }>()
export const CACHE_TTL = 30_000 // 30 seconds

export function clearDashboardCache() {
  dashboardCache.clear()
}
