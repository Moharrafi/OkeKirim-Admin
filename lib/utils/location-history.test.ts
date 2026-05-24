import { describe, it, expect, beforeEach, vi } from "vitest"
import { loadLocationHistory, saveLocationToHistory } from "./location-history"

// Mock localStorage for Node.js test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock })

describe("location-history", () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe("loadLocationHistory", () => {
    it("returns empty array when no history exists", () => {
      expect(loadLocationHistory("user-1")).toEqual([])
    })

    it("returns empty array when stored value is not valid JSON", () => {
      localStorageMock.setItem("location_history_user-1", "not-json")
      expect(loadLocationHistory("user-1")).toEqual([])
    })

    it("returns empty array when stored value is not an array", () => {
      localStorageMock.setItem("location_history_user-1", JSON.stringify({ foo: "bar" }))
      expect(loadLocationHistory("user-1")).toEqual([])
    })

    it("filters out invalid entries", () => {
      localStorageMock.setItem(
        "location_history_user-1",
        JSON.stringify([
          { value: "Jakarta", frequency: 5 },
          { value: 123, frequency: 2 }, // invalid: value not string
          { value: "Bandung" }, // invalid: missing frequency
          { value: "Surabaya", frequency: 3 },
        ])
      )
      const result = loadLocationHistory("user-1")
      expect(result).toEqual([
        { value: "Jakarta", frequency: 5 },
        { value: "Surabaya", frequency: 3 },
      ])
    })

    it("loads valid history correctly", () => {
      const history = [
        { value: "Jakarta", frequency: 10 },
        { value: "Bandung", frequency: 5 },
      ]
      localStorageMock.setItem("location_history_user-1", JSON.stringify(history))
      expect(loadLocationHistory("user-1")).toEqual(history)
    })

    it("uses user-specific key", () => {
      localStorageMock.setItem(
        "location_history_user-1",
        JSON.stringify([{ value: "Jakarta", frequency: 3 }])
      )
      localStorageMock.setItem(
        "location_history_user-2",
        JSON.stringify([{ value: "Bandung", frequency: 7 }])
      )
      expect(loadLocationHistory("user-1")).toEqual([{ value: "Jakarta", frequency: 3 }])
      expect(loadLocationHistory("user-2")).toEqual([{ value: "Bandung", frequency: 7 }])
    })
  })

  describe("saveLocationToHistory", () => {
    it("adds new location with frequency 1", () => {
      saveLocationToHistory("user-1", "Jakarta")
      const history = loadLocationHistory("user-1")
      expect(history).toEqual([{ value: "Jakarta", frequency: 1 }])
    })

    it("increments frequency for existing location", () => {
      saveLocationToHistory("user-1", "Jakarta")
      saveLocationToHistory("user-1", "Jakarta")
      saveLocationToHistory("user-1", "Jakarta")
      const history = loadLocationHistory("user-1")
      expect(history).toEqual([{ value: "Jakarta", frequency: 3 }])
    })

    it("matches existing locations case-insensitively", () => {
      saveLocationToHistory("user-1", "Jakarta")
      saveLocationToHistory("user-1", "jakarta")
      saveLocationToHistory("user-1", "JAKARTA")
      const history = loadLocationHistory("user-1")
      expect(history).toHaveLength(1)
      expect(history[0].frequency).toBe(3)
    })

    it("does not save empty or whitespace-only locations", () => {
      saveLocationToHistory("user-1", "")
      saveLocationToHistory("user-1", "   ")
      expect(loadLocationHistory("user-1")).toEqual([])
    })

    it("trims whitespace from location values", () => {
      saveLocationToHistory("user-1", "  Jakarta  ")
      const history = loadLocationHistory("user-1")
      expect(history).toEqual([{ value: "Jakarta", frequency: 1 }])
    })

    it("handles multiple different locations", () => {
      saveLocationToHistory("user-1", "Jakarta")
      saveLocationToHistory("user-1", "Bandung")
      saveLocationToHistory("user-1", "Surabaya")
      const history = loadLocationHistory("user-1")
      expect(history).toHaveLength(3)
      expect(history.find(h => h.value === "Jakarta")?.frequency).toBe(1)
      expect(history.find(h => h.value === "Bandung")?.frequency).toBe(1)
      expect(history.find(h => h.value === "Surabaya")?.frequency).toBe(1)
    })

    it("stores under user-specific key", () => {
      saveLocationToHistory("user-1", "Jakarta")
      saveLocationToHistory("user-2", "Bandung")
      expect(loadLocationHistory("user-1")).toEqual([{ value: "Jakarta", frequency: 1 }])
      expect(loadLocationHistory("user-2")).toEqual([{ value: "Bandung", frequency: 1 }])
    })
  })
})
