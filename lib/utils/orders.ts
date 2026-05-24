/**
 * Order utility functions for filtering, grouping, and overdue detection.
 */

import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns"
import { id as localeId } from "date-fns/locale/id"

/**
 * Order interface matching the project's existing Order type.
 */
export interface Order {
  id: string
  driver: string
  driverId: string
  vehicle: string
  lokasiMuat: string
  lokasiBongkar: string
  argo: number
  companyShare: number
  paidAmount: number
  sisa: number
  type: "online" | "offline"
  date: string
  time: string
  status: string
}

/**
 * Grouped orders by date for display in the order list.
 */
export interface GroupedOrders {
  date: string // "DD MMM YYYY" format
  dateRaw: Date
  orders: Order[]
}

/**
 * Checks whether an order is overdue based on calendar day difference.
 *
 * @param orderDate - The order creation date as an ISO string (e.g. "2025-01-15")
 * @param days - The threshold number of days after which an order is considered overdue
 * @returns true if the order date is more than `days` calendar days ago
 */
export function isOverdue(orderDate: string, days: number): boolean {
  const order = startOfDay(parseISO(orderDate))
  const today = startOfDay(new Date())
  const diff = differenceInCalendarDays(today, order)
  return diff > days
}

/**
 * Filters orders by a search query with case-insensitive partial match
 * on driver name, lokasi muat, lokasi bongkar, and order ID.
 *
 * @param orders - The list of orders to filter
 * @param query - The search query string (minimum 1 character for filtering)
 * @returns Filtered list of orders matching the query
 */
export function filterOrders(orders: Order[], query: string): Order[] {
  const trimmed = query.trim()
  if (trimmed.length === 0) return orders

  const lowerQuery = trimmed.toLowerCase()

  return orders.filter((order) => {
    return (
      order.driver.toLowerCase().includes(lowerQuery) ||
      order.lokasiMuat.toLowerCase().includes(lowerQuery) ||
      order.lokasiBongkar.toLowerCase().includes(lowerQuery) ||
      order.id.toLowerCase().includes(lowerQuery)
    )
  })
}

/**
 * Groups orders by date, sorted with the most recent date first.
 * Each group has a formatted date header in "DD MMM YYYY" format (Indonesian locale).
 *
 * @param orders - The list of orders to group
 * @returns Array of grouped orders sorted by date descending
 */
export function groupOrdersByDate(orders: Order[]): GroupedOrders[] {
  const groupMap = new Map<string, { dateRaw: Date; orders: Order[] }>()

  for (const order of orders) {
    const dateRaw = startOfDay(parseISO(order.date))
    const dateKey = dateRaw.toISOString()

    if (groupMap.has(dateKey)) {
      groupMap.get(dateKey)!.orders.push(order)
    } else {
      groupMap.set(dateKey, { dateRaw, orders: [order] })
    }
  }

  const groups: GroupedOrders[] = Array.from(groupMap.values()).map(
    ({ dateRaw, orders: groupOrders }) => ({
      date: format(dateRaw, "dd MMM yyyy", { locale: localeId }),
      dateRaw,
      orders: groupOrders,
    })
  )

  // Sort by date descending (most recent first)
  groups.sort((a, b) => b.dateRaw.getTime() - a.dateRaw.getTime())

  return groups
}
