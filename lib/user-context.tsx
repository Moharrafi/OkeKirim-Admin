"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { initPushNotifications, resetPushNotifications } from "./push-notifications"

type UserRole = "admin" | "driver"

interface User {
  id: string
  name: string
  email: string
  role: UserRole
  vehicle?: string
  phone?: string
}

interface UserContextType {
  user: User
  setUserRole: (role: UserRole) => void
  isAdmin: boolean
  isDriver: boolean
  isAuthenticated: boolean
  login: (role: UserRole, driverName?: string) => Promise<void>
  logout: () => Promise<void>
}

const defaultAdminUser: User = {
  id: "admin-1",
  name: "Admin Driver",
  email: "admin@driverpay.id",
  role: "admin",
  phone: "+62 812 3456 7890",
}

const defaultDriverUser: User = {
  id: "driver-1",
  name: "Ahmad Sutrisno",
  email: "ahmad@driverpay.id",
  role: "driver",
  vehicle: "B 1234 ABC",
  phone: "+62 813 9876 5432",
}

const UserContext = createContext<UserContextType | undefined>(undefined)

const driverStorageKeys = ["driverName", "driverVehicle", "driverPhone", "driverEmail"]

function clearDriverIdentity() {
  driverStorageKeys.forEach((key) => localStorage.removeItem(key))
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("admin")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    const savedRole = localStorage.getItem("userRole") as UserRole
    const savedAuth = localStorage.getItem("isAuthenticated")
    if (savedRole) {
      setRole(savedRole)
    }
    if (savedAuth === "true") {
      setIsAuthenticated(true)
      if (savedRole === "driver") {
        const driverName = localStorage.getItem("driverName")
        if (driverName) {
          initPushNotifications(driverName, "driver")
        }
      } else if (savedRole === "admin") {
        const staleDriverName = localStorage.getItem("driverName") || undefined
        clearDriverIdentity()

        void (async () => {
          if (staleDriverName) {
            await resetPushNotifications(staleDriverName)
          }
          await initPushNotifications("Admin", "admin")
        })()
      }
    }
  }, [])

  const setUserRole = (newRole: UserRole) => {
    setRole(newRole)
    localStorage.setItem("userRole", newRole)
  }

  const login = async (newRole: UserRole, driverName?: string) => {
    const previousDriverName = localStorage.getItem("driverName") || undefined

    await resetPushNotifications(previousDriverName)

    setRole(newRole)
    setIsAuthenticated(true)
    localStorage.setItem("userRole", newRole)
    localStorage.setItem("isAuthenticated", "true")

    if (newRole === "driver" && driverName) {
      clearDriverIdentity()
      localStorage.setItem("driverName", driverName)
      await initPushNotifications(driverName, "driver")
    } else if (newRole === "admin") {
      clearDriverIdentity()
      await initPushNotifications("Admin", "admin")
    }
  }

  const logout = async () => {
    const driverName = localStorage.getItem("driverName") || undefined

    await resetPushNotifications(driverName)

    setIsAuthenticated(false)
    setRole("admin")
    localStorage.removeItem("isAuthenticated")
    localStorage.removeItem("userRole")
    clearDriverIdentity()
  }

  const user = role === "admin" ? defaultAdminUser : (() => {
    if (typeof window === "undefined") return defaultDriverUser
    const name = localStorage.getItem("driverName") || defaultDriverUser.name
    const vehicle = localStorage.getItem("driverVehicle") || defaultDriverUser.vehicle
    const phone = localStorage.getItem("driverPhone") || defaultDriverUser.phone
    const email = localStorage.getItem("driverEmail") || defaultDriverUser.email
    return { ...defaultDriverUser, name, vehicle, phone, email }
  })()

  if (!mounted) {
    return null
  }

  return (
    <UserContext.Provider value={{
      user,
      setUserRole,
      isAdmin: role === "admin",
      isDriver: role === "driver",
      isAuthenticated,
      login,
      logout,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
