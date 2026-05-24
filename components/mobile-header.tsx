"use client"

import { useState, useEffect } from "react"
import { Bell, Settings, ChevronLeft, Clock, X, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { useUser } from "@/lib/user-context"

interface OverdueOrder {
  id: number
  driver: string
  origin: string
  destination: string
  fare: number
  date: string
  daysOverdue: number
  notifTitle?: string
  notifBody?: string
  notifType?: string
  isRead?: boolean
}

interface MobileHeaderProps {
  title?: string
  showGreeting?: boolean
  showBack?: boolean
  onBack?: () => void
  overdueCount?: number
}

export function MobileHeader({ title, showGreeting = false, showBack = false, onBack, overdueCount = 0 }: MobileHeaderProps) {
  const { user, isAdmin } = useUser()
  const [showNotifications, setShowNotifications] = useState(false)
  const [overdueOrders, setOverdueOrders] = useState<OverdueOrder[]>([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)

  // Check for unread notifications on mount
  useEffect(() => {
    async function checkUnread() {
      try {
        const res = await fetch(`/api/notifications?role=${isAdmin ? "admin" : "driver"}&unread=true&limit=1`)
        if (res.ok) {
          const data = await res.json()
          setHasUnread((data.unreadCount || 0) > 0)
        }
      } catch {
        // If notifications API fails, don't show dot
        setHasUnread(false)
      }
    }
    checkUnread()
  }, [isAdmin])

  // Prevent body scroll when notification panel is open
  useEffect(() => {
    if (showNotifications) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [showNotifications])

  const handleBellClick = async () => {
    setShowNotifications(true)
    setHasUnread(false) // Hide dot when panel is opened
    if (overdueOrders.length === 0) {
      setLoadingNotifs(true)
      try {
        // Fetch real notifications from database
        const notifRes = await fetch(`/api/notifications?role=${isAdmin ? "admin" : "driver"}&limit=30`)
        let dbNotifications: OverdueOrder[] = []
        
        if (notifRes.ok) {
          const notifData = await notifRes.json()
          dbNotifications = (notifData.notifications || []).map((n: any) => {
            const data = typeof n.data === "string" ? JSON.parse(n.data || "{}") : (n.data || {})
            return {
              id: n.id,
              driver: data.driver || n.title || "",
              origin: "",
              destination: "",
              fare: Number(data.amount) || 0,
              date: n.created_at || "",
              daysOverdue: 0,
              notifTitle: n.title,
              notifBody: n.body,
              notifType: n.type,
              isRead: n.is_read === 1,
            }
          })
        }

        // Also fetch overdue orders from tarikan API
        const params = new URLSearchParams()
        if (!isAdmin && user.name) params.set("driver", user.name)
        params.set("filter", "pending")
        const res = await fetch(`/api/tarikan?${params.toString()}`)
        let overdueList: OverdueOrder[] = []
        
        if (res.ok) {
          const data = await res.json()
          const orders = data.orders || data || []
          const now = new Date()
          overdueList = orders
            .filter((o: any) => {
              const orderDate = new Date(o.date || o.created_at)
              const diffDays = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24))
              return diffDays > 3
            })
            .slice(0, 20)
            .map((o: any) => {
              const orderDate = new Date(o.date || o.created_at)
              const diffDays = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24))
              return {
                id: o.id + 100000,
                driver: o.driver || o.driver_name || "",
                origin: o.origin || o.lokasi_muat || "",
                destination: o.destination || o.lokasi_bongkar || "",
                fare: o.companyShare || o.fare || o.argo || 0,
                date: o.date || o.created_at || "",
                daysOverdue: diffDays,
              }
            })
        }

        // Combine: real notifications first, then overdue orders
        if (dbNotifications.length > 0) {
          setOverdueOrders([...dbNotifications, ...overdueList])
        } else {
          setOverdueOrders(overdueList)
        }
      } catch {}
      setLoadingNotifs(false)
    }
  }

  function formatRupiah(amount: number): string {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  }

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
                <AvatarImage src="/avatar.jpg" alt={`Foto profil ${user.name}`} />
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
                      ? `${overdueOrders.filter(o => !o.notifType).length} tertunggak · ${overdueOrders.filter(o => o.notifType).length} aktivitas`
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
                      } catch {}
                    }}
                  >
                    Tandai dibaca
                  </Button>
                )}
              </div>
            </div>

            {/* Notification Content */}
            <div className="flex-1 overflow-y-auto pb-24">
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
                  {/* Summary card */}
                  <div className="mb-4 rounded-xl bg-destructive/10 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/20">
                        <Clock className="h-5 w-5 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{overdueOrders.length} Orderan Tertunggak</p>
                        <p className="text-xs text-muted-foreground">
                          Total Rp {formatRupiah(overdueOrders.reduce((sum, o) => sum + o.fare, 0))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Order list */}
                  {overdueOrders.map(order => (
                    <Link 
                      key={order.id} 
                      href="/deposit"
                      className={`flex items-start gap-3 rounded-xl p-4 transition-colors active:bg-secondary ${order.notifType ? "bg-card" : "bg-card"} ${order.isRead === false ? "bg-primary/5" : "bg-card"}`}
                      onClick={() => setShowNotifications(false)}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        order.notifType === "deposit_payment" ? "bg-success/10" :
                        order.notifType === "new_order" ? "bg-primary/10" :
                        "bg-destructive/10"
                      }`}>
                        {order.notifType === "deposit_payment" ? (
                          <Bell className="h-4 w-4 text-success" />
                        ) : order.notifType === "new_order" ? (
                          <Bell className="h-4 w-4 text-primary" />
                        ) : (
                          <Clock className="h-4 w-4 text-destructive" />
                        )}
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
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-foreground">{order.driver}</p>
                              <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                                {order.daysOverdue} hari
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {order.origin} → {order.destination}
                            </p>
                            <div className="mt-1.5 flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground">
                                Rp {formatRupiah(order.fare)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDate(order.date)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-20">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Bell className="h-7 w-7 text-primary" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">Semua beres!</p>
                  <p className="mt-1 text-xs text-muted-foreground text-center">Tidak ada orderan yang tertunggak saat ini</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
