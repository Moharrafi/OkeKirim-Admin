import { describe, it, expect } from "vitest"
import { getLocationSuggestions, LocationHistory } from "./location"

describe("getLocationSuggestions", () => {
  const sampleHistory: LocationHistory[] = [
    { value: "Jakarta Utara", frequency: 10 },
    { value: "Jakarta Selatan", frequency: 8 },
    { value: "Bandung", frequency: 15 },
    { value: "Surabaya", frequency: 5 },
    { value: "Jakarta Barat", frequency: 3 },
    { value: "Jakarta Timur", frequency: 12 },
    { value: "Semarang", frequency: 7 },
  ]

  it("returns empty array when input is less than 2 characters", () => {
    expect(getLocationSuggestions("", sampleHistory)).toEqual([])
    expect(getLocationSuggestions("J", sampleHistory)).toEqual([])
    expect(getLocationSuggestions("a", sampleHistory)).toEqual([])
  })

  it("returns empty array when input is exactly 1 character", () => {
    expect(getLocationSuggestions("B", sampleHistory)).toEqual([])
  })

  it("filters by case-insensitive substring match", () => {
    const results = getLocationSuggestions("jakarta", sampleHistory)
    expect(results.every((r) => r.toLowerCase().includes("jakarta"))).toBe(true)
  })

  it("is case-insensitive for input matching", () => {
    const lower = getLocationSuggestions("jakarta", sampleHistory)
    const upper = getLocationSuggestions("JAKARTA", sampleHistory)
    const mixed = getLocationSuggestions("JaKaRtA", sampleHistory)
    expect(lower).toEqual(upper)
    expect(lower).toEqual(mixed)
  })

  it("returns max 5 suggestions", () => {
    // "ja" matches all 4 Jakarta entries, but let's use a broader match
    const results = getLocationSuggestions("ja", sampleHistory)
    expect(results.length).toBeLessThanOrEqual(5)
  })

  it("sorts results by frequency descending", () => {
    const results = getLocationSuggestions("Jakarta", sampleHistory)
    // Jakarta Timur (12), Jakarta Utara (10), Jakarta Selatan (8), Jakarta Barat (3)
    expect(results).toEqual([
      "Jakarta Timur",
      "Jakarta Utara",
      "Jakarta Selatan",
      "Jakarta Barat",
    ])
  })

  it("returns empty array when no matches found", () => {
    expect(getLocationSuggestions("Yogyakarta", sampleHistory)).toEqual([])
  })

  it("returns empty array when history is empty", () => {
    expect(getLocationSuggestions("Jakarta", [])).toEqual([])
  })

  it("limits to 5 results when more than 5 match", () => {
    const largeHistory: LocationHistory[] = [
      { value: "Jalan Sudirman", frequency: 10 },
      { value: "Jalan Thamrin", frequency: 9 },
      { value: "Jalan Gatot Subroto", frequency: 8 },
      { value: "Jalan Kuningan", frequency: 7 },
      { value: "Jalan Rasuna Said", frequency: 6 },
      { value: "Jalan HR Muhammad", frequency: 5 },
      { value: "Jalan Ahmad Yani", frequency: 4 },
    ]
    const results = getLocationSuggestions("Jalan", largeHistory)
    expect(results).toHaveLength(5)
    // Should be the top 5 by frequency
    expect(results).toEqual([
      "Jalan Sudirman",
      "Jalan Thamrin",
      "Jalan Gatot Subroto",
      "Jalan Kuningan",
      "Jalan Rasuna Said",
    ])
  })

  it("matches substring anywhere in the value", () => {
    const results = getLocationSuggestions("Selatan", sampleHistory)
    expect(results).toEqual(["Jakarta Selatan"])
  })

  it("works with exactly 2 character input", () => {
    const results = getLocationSuggestions("Ba", sampleHistory)
    expect(results).toContain("Bandung")
    expect(results).toContain("Jakarta Barat")
    expect(results).toContain("Surabaya")
  })
})
