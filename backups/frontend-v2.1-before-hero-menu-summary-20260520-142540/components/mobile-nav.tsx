"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Wallet, MapPin, History, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"

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
  const navItems = isAdmin ? adminNavItems : driverNavItems

  if (pathname === "/login" || !isAuthenticated) {
    return null
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2" aria-label="Navigasi utama" role="navigation">
      <div
        className="grid rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-[0_8px_28px_rgba(15,23,42,0.14)] backdrop-blur-xl"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground active:bg-secondary"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} aria-hidden="true" />
              <span className={cn("text-[10px] leading-none", isActive ? "font-semibold" : "font-medium")}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
