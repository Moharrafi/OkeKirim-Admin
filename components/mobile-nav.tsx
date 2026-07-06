"use client"
import { useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Wallet, MapPin, User, QrCode, History } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/user-context"

const adminNavItems = [
  { href: "/", icon: Home, label: "Beranda" },
  { href: "/lokasi", icon: MapPin, label: "Lokasi" },
  { href: "/deposit", icon: QrCode, label: "Deposit", isCenter: true },
  { href: "/history", icon: History, label: "Riwayat" },
  { href: "/profile", icon: User, label: "Profil" },
]

const driverNavItems = [
  { href: "/", icon: Home, label: "Beranda" },
  { href: "/history", icon: History, label: "Riwayat" },
  { href: "/deposit", icon: QrCode, label: "Setoran", isCenter: true },
  { href: "/hutang", icon: Wallet, label: "Hutang" },
  { href: "/profile", icon: User, label: "Profil" },
]

/**
 * Determines which nav item is active based on the current pathname.
 */
function getActiveHref(pathname: string, navItems: typeof adminNavItems): string {
  const exactMatch = navItems.find((item) => item.href === pathname)
  if (exactMatch) return exactMatch.href

  const prefixMatch = navItems
    .filter((item) => item.href !== "/")
    .find((item) => pathname.startsWith(item.href + "/") || pathname.startsWith(item.href))
  if (prefixMatch) return prefixMatch.href

  return "/"
}

export function MobileNav() {
  const pathname = usePathname()
  const { isAdmin, isAuthenticated } = useUser()
  const navItems = isAdmin ? adminNavItems : driverNavItems
  // Track the "visual" active index for instant pill movement on tap
  const [tappedIndex, setTappedIndex] = useState<number | null>(null)

  if (pathname === "/login" || !isAuthenticated) {
    return null
  }

  const activeHref = getActiveHref(pathname, navItems)
  const routeIndex = navItems.findIndex((item) => item.href === activeHref)
  // Use tapped index if set, otherwise use route-based index
  const activeIndex = tappedIndex !== null ? tappedIndex : routeIndex
  const activeItem = navItems[activeIndex]
  const isActiveCenter = activeItem?.isCenter ?? false
  const count = navItems.length

  // Reset tapped index when route catches up
  if (tappedIndex !== null && tappedIndex === routeIndex) {
    // Will reset on next render cycle naturally
    queueMicrotask(() => setTappedIndex(null))
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3.5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2 print:hidden" aria-label="Navigasi utama" role="navigation">
      <div
        className="relative grid rounded-2xl border border-border/50 bg-card/95 p-1.5 shadow-[0_8px_32px_rgba(15,23,42,0.12)] backdrop-blur-xl"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {/* GPU-accelerated sliding pill — uses transform instead of left/width */}
        {!isActiveCenter && (
          <div
            className="absolute top-1.5 bottom-1.5 left-1.5 z-0 rounded-xl bg-primary/10 dark:bg-primary/15 will-change-transform transition-transform duration-300 ease-out"
            style={{
              width: `calc((100% - 12px) / ${count})`,
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />
        )}

        {navItems.map((item, index) => {
          const isActive = activeIndex === index

          if (item.isCenter) {
            return (
              <div key={item.href} className="relative flex justify-center col-span-1">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setTappedIndex(index)}
                  className={cn(
                    "absolute -top-7 flex h-14 w-14 flex-col items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 border-[4px] border-card z-20",
                    isActive 
                      ? "bg-primary shadow-primary/30 scale-105 border-blue-100 dark:border-blue-900 ring-4 ring-primary/20" 
                      : "bg-primary shadow-primary/30 hover:bg-primary/95 hover:shadow-primary/40"
                  )}
                >
                  <item.icon className="h-5 w-5 stroke-[2.5]" aria-hidden="true" />
                  <span className="text-[7.5px] font-black tracking-wider uppercase mt-0.5 leading-none">
                    {item.label === "Setoran" || item.label === "Deposit" ? "SETOR" : item.label.toUpperCase()}
                  </span>
                </Link>
                {/* Spacer to preserve height in grid */}
                <div className="h-11" />
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setTappedIndex(index)}
              className={cn(
                "relative z-10 flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-center transition-colors duration-200",
                isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground active:scale-95 dark:text-muted-foreground dark:active:text-white"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 transition-all duration-200",
                  isActive ? "stroke-[2.6]" : "stroke-[1.8]"
                )}
                fill="none"
                aria-hidden="true"
              />
              <span
                className={cn(
                  "text-[9px] leading-none transition-all duration-200",
                  isActive ? "font-bold" : "font-medium"
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

export { getActiveHref }
