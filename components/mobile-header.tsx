"use client"

import { useCallback, useEffect, useMemo, useState, type UIEvent } from "react"
import { Bell, Settings, ChevronLeft, Clock, ArrowLeft, Wallet, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { useUser } from "@/lib/user-context"

interface OverdueOrder {
  id: number
  driver: string
  date: string
  notifTitle?: string
  notifBody?: string
  notifType?: string
  isRead?: boolean
  url?: string
}

interface MobileHeaderProps {
  title?: string
  showGreeting?: boolean
  showBack?: boolean
  onBack?: () => void
  overdueCount?: number
}

const NOTIFICATION_PAGE_SIZE = 10

function sortNotifications(items: OverdueOrder[]) {
  return [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

function dedupeNotifications(items: OverdueOrder[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.notifType ? "notif" : "overdue"}-${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mapDbNotification(n: any): OverdueOrder {
  let data: Record<string, any> = {}
  try {
    data = typeof n.data === "string" ? JSON.parse(n.data || "{}") : (n.data || {})
  } catch {}

  return {
    id: n.id,
    driver: data.driver || n.title || "",
    date: n.created_at || "",
    notifTitle: n.title,
    notifBody: n.body,
    notifType: n.type,
    isRead: n.is_read === 1,
    url: data.url || "/deposit",
  }
}

function getDateGroupLabel(dateStr: string) {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return "Tanggal tidak diketahui"

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const key = date.toLocaleDateString("id-ID")
  if (key === today.toLocaleDateString("id-ID")) return "Hari Ini"
  if (key === yesterday.toLocaleDateString("id-ID")) return "Kemarin"

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function getNotificationIconConfig(order: OverdueOrder) {
  if (order.notifType === "deposit_payment") {
    return {
      className: "bg-success/10",
      icon: <Wallet className="h-4 w-4 text-success" />,
    }
  }

  if (order.notifType === "new_order") {
    return {
      className: "bg-primary/10",
      icon: <Bell className="h-4 w-4 text-primary" />,
    }
  }

  if (order.notifType === "gps_missing_deposit") {
    return {
      className: "bg-warning/10",
      icon: <MapPin className="h-4 w-4 text-warning" />,
    }
  }

  return {
    className: "bg-primary/10",
    icon: <Bell className="h-4 w-4 text-primary" />,
  }
}

export function MobileHeader({ title, showGreeting = false, showBack = false, onBack, overdueCount = 0 }: MobileHeaderProps) {
  const { user, isAdmin } = useUser()
  const [showNotifications, setShowNotifications] = useState(false)
  const [overdueOrders, setOverdueOrders] = useState<OverdueOrder[]>([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)
  const [loadingMoreNotifs, setLoadingMoreNotifs] = useState(false)
  const [notificationOffset, setNotificationOffset] = useState(0)
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true)
  const [hasUnread, setHasUnread] = useState(false)

  const checkUnreadNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?role=${isAdmin ? "admin" : "driver"}&unread=true&limit=1`)
      if (res.ok) {
        const data = await res.json()
        setHasUnread((data.unreadCount || 0) > 0)
      }
    } catch {
      // If notifications API fails, keep the current badge state.
    }
  }, [isAdmin])

  // Keep the bell badge in sync without loading the full notification list.
  useEffect(() => {
    checkUnreadNotifications()

    const intervalId = window.setInterval(checkUnreadNotifications, 30000)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkUnreadNotifications()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [checkUnreadNotifications])

  // Prevent body scroll when notification panel is open
  useEffect(() => {
    if (showNotifications) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [showNotifications])

  const loadNotifications = useCallback(async (reset = false, syncGps = false) => {
    if (!reset && loadingMoreNotifs) return
    if (!reset && !hasMoreNotifications) return

    if (reset && overdueOrders.length === 0) {
      setLoadingNotifs(true)
    } else if (!reset) {
      setLoadingMoreNotifs(true)
    }

    try {
      const nextNotificationOffset = reset ? 0 : notificationOffset
      const notifParams = new URLSearchParams({
        role: isAdmin ? "admin" : "driver",
        limit: String(NOTIFICATION_PAGE_SIZE),
        offset: String(nextNotificationOffset),
      })
      if (isAdmin && syncGps) notifParams.set("sync", "gps-today")

      const notifRes = reset || hasMoreNotifications
        ? await fetch(`/api/notifications?${notifParams.toString()}`)
        : null

      let dbNotifications: OverdueOrder[] = []
      if (notifRes?.ok) {
        const notifData = await notifRes.json()
        dbNotifications = (notifData.notifications || []).map(mapDbNotification)
        setHasUnread((notifData.unreadCount || 0) > 0)
        setNotificationOffset(Number(notifData.nextOffset || nextNotificationOffset + dbNotifications.length))
        setHasMoreNotifications(Boolean(notifData.hasMore))
      } else if (reset) {
        setNotificationOffset(0)
        setHasMoreNotifications(false)
      }

      setOverdueOrders((prev) => {
        const next = reset ? dbNotifications : [...prev, ...dbNotifications]
        return sortNotifications(dedupeNotifications(next))
      })
    } catch {}
    setLoadingNotifs(false)
    setLoadingMoreNotifs(false)
  }, [
    hasMoreNotifications,
    isAdmin,
    loadingMoreNotifs,
    notificationOffset,
    overdueOrders.length,
  ])

  const handleBellClick = async () => {
    setShowNotifications(true)
    setOverdueOrders([])
    setNotificationOffset(0)
    setHasMoreNotifications(true)
    await loadNotifications(true)
    if (isAdmin) {
      loadNotifications(true, true)
    }
  }

  const groupedNotifications = useMemo(() => {
    const groups = new Map<string, OverdueOrder[]>()
    for (const order of overdueOrders) {
      const label = getDateGroupLabel(order.date)
      groups.set(label, [...(groups.get(label) || []), order])
    }
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
  }, [overdueOrders])

  const handleNotificationsScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight
    if (distanceFromBottom < 240) {
      loadNotifications(false)
    }
  }, [loadNotifications])

  function formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    } catch {
      return dateStr
    }
  }
  
  return (
    <>
      <header className="safe-area-top sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-xl" role="banner">
        <div className="flex min-h-[60px] items-center justify-between px-4 py-2.5">
          {showGreeting ? (
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 border border-primary/20 bg-primary/10">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {user.name.split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Selamat datang</p>
                <p className="text-base font-semibold leading-tight text-foreground">{user.name}</p>
              </div>
            </div>
          ) : showBack ? (
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="-ml-2 h-10 w-10 rounded-lg text-foreground"
                onClick={onBack}
                aria-label="Kembali"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </Button>
              <h1 className="text-lg font-bold text-foreground">{title}</h1>
            </div>
          ) : (
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
          )}
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative h-10 w-10 rounded-lg text-muted-foreground" 
              aria-label="Notifikasi"
              onClick={handleBellClick}
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {hasUnread && (
                <span
                  className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background"
                  aria-label="Ada notifikasi baru"
                />
              )}
            </Button>
            <Link href="/profile" aria-label="Pengaturan">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg text-muted-foreground" aria-label="Pengaturan">
                <Settings className="h-5 w-5" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Full-screen Notification Panel */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 animate-slide-in-right">
          <div className="flex h-full flex-col bg-background">
            {/* Notification Header */}
            <div className="safe-area-top sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur-xl">
              <div className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 rounded-lg text-foreground"
                  onClick={() => setShowNotifications(false)}
                  aria-label="Kembali"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                  <h1 className="text-lg font-bold text-foreground">Notifikasi</h1>
                  <p className="text-[11px] text-muted-foreground">
                    {overdueOrders.length > 0
                      ? `${overdueOrders.length} notifikasi`
                      : loadingNotifs ? "Memuat..." : "Tidak ada notifikasi"
                    }
                  </p>
                </div>
                {overdueOrders.some(o => o.isRead === false) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-primary"
                    onClick={async () => {
                      try {
                        await fetch("/api/notifications", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ markAll: true, role: isAdmin ? "admin" : "driver" }),
                        })
                        setOverdueOrders(prev => prev.map(o => ({ ...o, isRead: true })))
                        setHasUnread(false)
                      } catch {}
                    }}
                  >
                    Tandai dibaca
                  </Button>
                )}
              </div>
            </div>

            {/* Notification Content */}
            <div className="flex-1 overflow-y-auto pb-24" onScroll={handleNotificationsScroll}>
              {loadingNotifs ? (
                <div className="space-y-4 p-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="animate-pulse flex items-start gap-3 rounded-xl bg-card p-4">
                      <div className="h-10 w-10 rounded-lg bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-2/3 rounded bg-muted" />
                        <div className="h-3 w-1/2 rounded bg-muted" />
                        <div className="h-2.5 w-1/3 rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : overdueOrders.length > 0 ? (
                <div className="p-4 space-y-2">
                  {groupedNotifications.map((group) => (
                    <div key={group.label} className="space-y-2">
                      <div className="sticky top-0 z-[1] -mx-4 bg-background/95 px-4 py-2 backdrop-blur-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.label}
                        </p>
                      </div>

                      {group.items.map(order => {
                        const iconConfig = getNotificationIconConfig(order)

                        return (
                        <Link
                          key={`${order.notifType ? "notif" : "overdue"}-${order.id}`}
                          href={order.url || "/deposit"}
                          className={`flex items-start gap-3 rounded-xl p-4 transition-colors active:bg-secondary ${order.notifType ? "bg-card" : "bg-card"} ${order.isRead === false ? "bg-primary/5" : "bg-card"}`}
                          onClick={() => setShowNotifications(false)}
                        >
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconConfig.className}`}>
                            {iconConfig.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            {order.notifTitle ? (
                              <>
                                <p className="text-sm font-semibold text-foreground">{order.notifTitle}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">{order.notifBody}</p>
                                <span className="mt-1 block text-[10px] text-muted-foreground">
                                  {formatDate(order.date)}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </Link>
                      )})}
                    </div>
                  ))}

                  {loadingMoreNotifs && (
                    <div className="flex items-center justify-center py-4">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="ml-2 text-xs text-muted-foreground">Memuat notifikasi lama...</span>
                    </div>
                  )}

                  {!loadingMoreNotifs && !hasMoreNotifications && (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      Semua notifikasi sudah dimuat
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-20">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Bell className="h-7 w-7 text-primary" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">Semua beres!</p>
                  <p className="mt-1 text-xs text-muted-foreground text-center">Tidak ada notifikasi admin saat ini</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
