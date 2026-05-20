"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Wallet, MapPin, History, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import { useMemo, useRef, useEffect, useState } from "react"

const adminNavItems = [
  { href: "/", icon: Home, label: "Beranda" },
  { href: "/deposit", icon: Wallet, label: "Deposit" },
  { href: "/lokasi", icon: MapPin, label: "Lokasi" },
  { href: "/history", icon: History, label: "Riwayat" },
  { href: "/profile", icon: User, label: "Profil" },
]

const driverNavItems = [
  { href: "/", icon: Home, label: "Beranda" },
  { href: "/deposit", icon: Wallet, label: "Setoran" },
  { href: "/history", icon: History, label: "Riwayat" },
  { href: "/profile", icon: User, label: "Profil" },
]

export function MobileNav() {
  const pathname = usePathname()
  const { isAdmin, isAuthenticated } = useUser()
  const navRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  const navItems = isAdmin ? adminNavItems : driverNavItems

  const activeIndex = useMemo(() => {
    const idx = navItems.findIndex((item) => item.href === pathname)
    return idx >= 0 ? idx : 0
  }, [pathname, navItems])

  useEffect(() => {
    if (navRef.current) {
      const activeEl = navRef.current.children[activeIndex + 1] as HTMLElement // +1 because indicator is first child
      if (activeEl) {
        setIndicatorStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
        })
      }
    }
  }, [activeIndex])

  // Hide nav on login page or when not authenticated
  if (pathname === "/login" || !isAuthenticated) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom" aria-label="Navigasi utama" role="navigation">
      <div
        ref={navRef}
        className="relative flex items-center py-2 px-1"
        style={{ display: "grid", gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}
      >
        {/* Animated active indicator */}
        <div
          className="absolute top-2 bottom-2 rounded-xl bg-primary/10 transition-all duration-300 ease-in-out"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
          aria-hidden="true"
        />

        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative z-10 flex flex-col items-center justify-center gap-1 rounded-xl py-2 transition-colors duration-200",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 transition-transform duration-300",
                  isActive && "scale-110"
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-all duration-200",
                  isActive && "font-semibold"
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
