import { NextRequest, NextResponse } from "next/server"

// Simple in-memory cache for geocoding results
const cache = new Map<string, { address: string; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 })
  }

  // Round to 4 decimals for cache key (~11m precision)
  const roundedLat = parseFloat(lat).toFixed(4)
  const roundedLng = parseFloat(lng).toFixed(4)
  const cacheKey = `${roundedLat},${roundedLng}`

  // Check cache
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ address: cached.address })
  }

  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "DriverDepositApp/1.0" } }
    )

    if (!resp.ok) {
      return NextResponse.json({ address: `${roundedLat}, ${roundedLng}` })
    }

    const data = await resp.json()
    const addr = data.address || {}
    const road = addr.road || addr.suburb || addr.city_district || addr.village || ""
    const area = addr.city || addr.town || addr.municipality || addr.county || ""

    let address = `${roundedLat}, ${roundedLng}`
    if (road && area) address = `${road}, ${area}`
    else if (road) address = road
    else if (area) address = area
    else {
      const display = data.display_name || ""
      if (display) address = display.split(",").slice(0, 3).join(",").trim()
    }

    // Store in cache
    cache.set(cacheKey, { address, timestamp: Date.now() })

    return NextResponse.json({ address })
  } catch {
    return NextResponse.json({ address: `${roundedLat}, ${roundedLng}` })
  }
}
