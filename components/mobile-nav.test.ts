import { describe, it, expect } from "vitest"
import { getActiveHref } from "./mobile-nav"

const adminNavItems = [
  { href: "/", icon: {} as any, label: "Beranda" },
  { href: "/deposit", icon: {} as any, label: "Deposit" },
  { href: "/lokasi", icon: {} as any, label: "Lokasi" },
  { href: "/hutang", icon: {} as any, label: "Hutang" },
  { href: "/history", icon: {} as any, label: "Riwayat" },
  { href: "/profile", icon: {} as any, label: "Profil" },
]

const driverNavItems = [
  { href: "/", icon: {} as any, label: "Beranda" },
  { href: "/deposit", icon: {} as any, label: "Setoran" },
  { href: "/hutang", icon: {} as any, label: "Hutang" },
  { href: "/history", icon: {} as any, label: "Riwayat" },
  { href: "/profile", icon: {} as any, label: "Profil" },
]

describe("getActiveHref", () => {
  describe("exact route matching", () => {
    it("returns / for home page", () => {
      expect(getActiveHref("/", adminNavItems)).toBe("/")
    })

    it("returns /deposit for deposit page", () => {
      expect(getActiveHref("/deposit", adminNavItems)).toBe("/deposit")
    })

    it("returns /history for history page", () => {
      expect(getActiveHref("/history", driverNavItems)).toBe("/history")
    })

    it("returns /profile for profile page", () => {
      expect(getActiveHref("/profile", driverNavItems)).toBe("/profile")
    })
  })

  describe("sub-route matching", () => {
    it("returns /deposit for /deposit/detail sub-route", () => {
      expect(getActiveHref("/deposit/detail", adminNavItems)).toBe("/deposit")
    })

    it("returns /deposit for /deposit/batch sub-route", () => {
      expect(getActiveHref("/deposit/batch", driverNavItems)).toBe("/deposit")
    })

    it("returns /history for /history/123 sub-route", () => {
      expect(getActiveHref("/history/123", adminNavItems)).toBe("/history")
    })

    it("returns /profile for /profile/settings sub-route", () => {
      expect(getActiveHref("/profile/settings", adminNavItems)).toBe("/profile")
    })
  })

  describe("exactly one item active at any time", () => {
    it("always returns exactly one href from the nav items", () => {
      const testPaths = ["/", "/deposit", "/deposit/detail", "/history", "/profile", "/unknown"]
      for (const path of testPaths) {
        const result = getActiveHref(path, adminNavItems)
        const matchCount = adminNavItems.filter((item) => item.href === result).length
        expect(matchCount).toBe(1)
      }
    })

    it("falls back to / for unknown routes", () => {
      expect(getActiveHref("/unknown-page", adminNavItems)).toBe("/")
    })
  })

  describe("home route does not match sub-routes of other items", () => {
    it("does not return / for /deposit path", () => {
      expect(getActiveHref("/deposit", adminNavItems)).toBe("/deposit")
      expect(getActiveHref("/deposit", adminNavItems)).not.toBe("/")
    })

    it("does not return / for /history path", () => {
      expect(getActiveHref("/history", adminNavItems)).toBe("/history")
      expect(getActiveHref("/history", adminNavItems)).not.toBe("/")
    })
  })
})
