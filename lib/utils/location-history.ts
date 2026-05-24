import { type LocationHistory } from './location'

/**
 * Get the localStorage key for a user's location history.
 */
function getStorageKey(userId: string): string {
  return `location_history_${userId}`
}

/**
 * Load location history from localStorage for a given user.
 * Returns an empty array if no history exists or localStorage is unavailable.
 */
export function loadLocationHistory(userId: string): LocationHistory[] {
  try {
    const key = getStorageKey(userId)
    const stored = localStorage.getItem(key)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    // Validate each entry has the expected shape
    return parsed.filter(
      (entry: unknown) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as LocationHistory).value === 'string' &&
        typeof (entry as LocationHistory).frequency === 'number'
    ) as LocationHistory[]
  } catch {
    return []
  }
}

/**
 * Save a location entry to the user's location history.
 * If the location already exists, increments its frequency counter.
 * If it's new, adds it with frequency 1.
 */
export function saveLocationToHistory(
  userId: string,
  location: string
): void {
  if (!location || !location.trim()) return

  try {
    const key = getStorageKey(userId)
    const history = loadLocationHistory(userId)
    const trimmedLocation = location.trim()
    const existingIndex = history.findIndex(
      (entry) => entry.value.toLowerCase() === trimmedLocation.toLowerCase()
    )

    if (existingIndex >= 0) {
      // Increment frequency for existing location
      history[existingIndex].frequency += 1
    } else {
      // Add new location with frequency 1
      history.push({ value: trimmedLocation, frequency: 1 })
    }

    localStorage.setItem(key, JSON.stringify(history))
  } catch {
    // Silently fail if localStorage is unavailable
  }
}
