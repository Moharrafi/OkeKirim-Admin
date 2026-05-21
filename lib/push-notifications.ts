"use client"

import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"

/**
 * Initialize push notifications for the current driver.
 * Call this after driver login.
 */
export async function initPushNotifications(driverName: string) {
  if (!Capacitor.isNativePlatform()) {
    console.log("Push notifications only available on native platform")
    return
  }

  try {
    const permResult = await PushNotifications.requestPermissions()
    if (permResult.receive !== "granted") {
      console.warn("Push notification permission not granted")
      return
    }

    await PushNotifications.register()

    PushNotifications.addListener("registration", async (token) => {
      console.log("FCM Token:", token.value)
      try {
        await fetch("/api/fcm-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driverName, token: token.value }),
        })
      } catch (err) {
        console.error("Failed to save FCM token:", err)
      }
    })

    PushNotifications.addListener("registrationError", (error) => {
      console.error("Push registration error:", error)
    })

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("Push received:", notification)
    })

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("Push action:", action)
      if (typeof window !== "undefined") {
        window.location.href = "/deposit?tab=setoran"
      }
    })
  } catch (error) {
    console.error("Push notification init error:", error)
  }
}
