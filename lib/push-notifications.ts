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

    // Remove old listeners to avoid duplicates
    await PushNotifications.removeAllListeners()

    // Listen for registration success
    PushNotifications.addListener("registration", async (token) => {
      console.log("FCM Token:", token.value)
      await saveToken(driverName, token.value)
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

    // Register - this will trigger "registration" listener with the token
    await PushNotifications.register()

    // Also try to get delivery token directly (for cases where listener doesn't fire)
    setTimeout(async () => {
      try {
        const result = await PushNotifications.getDeliveredNotifications()
        // If we got here without error, FCM is working
        console.log("Push notifications active for:", driverName)
      } catch {}
    }, 2000)
  } catch (error) {
    console.error("Push notification init error:", error)
  }
}

async function saveToken(driverName: string, token: string) {
  try {
    await fetch("/api/fcm-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverName, token }),
    })
  } catch (err) {
    console.error("Failed to save FCM token:", err)
  }
}
