"use client"

import { useEffect } from "react"
import { App } from "@capacitor/app"
import { Capacitor } from "@capacitor/core"

export const ANDROID_BACK_EVENT = "android-back-button"

function getFallbackPath(pathname: string) {
  if (pathname === "/lokasi/history") return "/lokasi"
  if (pathname === "/profile") return "/"
  return null
}

export function AndroidBackHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let removeListener: (() => void) | undefined

    App.addListener("backButton", ({ canGoBack }) => {
      const event = new CustomEvent(ANDROID_BACK_EVENT, { cancelable: true })
      window.dispatchEvent(event)

      if (event.defaultPrevented) return

      if (canGoBack) {
        window.history.back()
        return
      }

      const fallbackPath = getFallbackPath(window.location.pathname)
      if (fallbackPath) {
        window.location.replace(fallbackPath)
        return
      }

      App.exitApp()
    }).then((handle) => {
      removeListener = () => {
        handle.remove()
      }
    })

    return () => {
      removeListener?.()
    }
  }, [])

  return null
}
