"use client"
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

  if (pathname === "/login" || !isAuthenticated) {
    return null
  }

  const activeHref = getActiveHref(pathname, navItems)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3.5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2 print:hidden" aria-label="Navigasi utama" role="navigation">
      <div
        className="relative grid rounded-2xl border border-border/50 bg-card/95 p-1.5 shadow-[0_8px_32px_rgba(15,23,42,0.12)] backdrop-blur-xl"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => {
          const isActive = activeHref === item.href

          if (item.isCenter) {
            return (
              <div key={item.href} className="relative flex justify-center col-span-1">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "absolute -top-7 flex h-14 w-14 flex-col items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-105 active:scale-95 border-[4px] border-card z-20",
                    isActive 
                      ? "bg-indigo-600 dark:bg-indigo-500 shadow-indigo-600/30 scale-105 border-indigo-100 dark:border-indigo-900 ring-4 ring-indigo-500/20" 
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
              className={cn(
                "relative z-10 flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-center transition-all",
                isActive
                  ? "bg-primary/10 text-primary font-bold scale-105"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground active:scale-95 dark:text-muted-foreground dark:hover:bg-white/5 dark:active:text-white"
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
                  "text-[9px] leading-none transition-all",
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


