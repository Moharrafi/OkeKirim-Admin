export interface LocationHistory {
  value: string
  frequency: number
}

/**
 * Get location suggestions based on user input and location history.
 *
 * Returns up to 5 suggestions filtered by case-insensitive substring match,
 * sorted by frequency descending. Returns empty array if input is less than
 * 2 characters.
 *
 * @param input - The current user input string
 * @param history - Array of location history entries with frequency counts
 * @returns Array of suggested location strings (max 5)
 */
export function getLocationSuggestions(
  input: string,
  history: LocationHistory[]
): string[] {
  if (input.length < 2) {
    return []
  }

  const normalizedInput = input.toLowerCase()

  return history
    .filter((entry) => entry.value.toLowerCase().includes(normalizedInput))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5)
    .map((entry) => entry.value)
}
