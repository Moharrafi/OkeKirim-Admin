"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/lib/user-context"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated } = useUser()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
