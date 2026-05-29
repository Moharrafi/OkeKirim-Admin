import pool from "@/lib/db"
import { ensureNotificationsTable } from "@/lib/notifications-schema"
import { notifyAdmins } from "@/lib/notify-admin"

const BASE_URL = "https://hosting.glonasssoft.ru"
const USERNAME = process.env.GLONASS_USERNAME || ""
const PASSWORD = process.env.GLONASS_PASSWORD || ""
const SYNC_TTL_MS = 10 * 60 * 1000

interface GlonassVehicle {
  id?: string
  Id?: string
  vehicleId?: number
  name?: string
  Name?: string
  number?: string
  StateNumber?: string
  GarageNumber?: string
}

interface DriverVehicleRow {
  name: string
  vehicle: string
}

interface NavPoint {
  lat: number
  lng: number
  speed: number
  timestamp: string
}

interface MovementSummary {
  moved: boolean
  totalDistance: number
  maxSpeed: number
}

interface SyncResult {
  date: string
  driversChecked: number
  gpsDrivers: number
  missingDeposit: number
  notificationsCreated: number
}

let syncCache: { timestamp: number; date: string; result: SyncResult } | null = null
let syncInFlight: Promise<SyncResult> | null = null

function getWibDateString() {
  const now = new Date()
  const wibOffset = 7 * 60 * 60 * 1000
  return new Date(now.getTime() + wibOffset).toISOString().split("T")[0]
}

function normalizeName(value: unknown) {
  return String(value || "").trim().toLowerCase()
}

function normalizePlate(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "")
}

function getVehicleLabels(vehicle: GlonassVehicle) {
  return [
    vehicle.number,
    vehicle.StateNumber,
    vehicle.GarageNumber,
    vehicle.Name,
    vehicle.name,
  ].map(normalizePlate).filter(Boolean)
}

function findVehicleByDriverVehicle(vehicles: GlonassVehicle[], driverVehicle: string) {
  const plate = normalizePlate(driverVehicle)
  if (!plate) return null

  return vehicles.find((vehicle) => {
    const labels = getVehicleLabels(vehicle)
    return labels.some((label) => label.includes(plate) || plate.includes(label))
  }) || null
}

function getVehicleDisplayName(vehicle: GlonassVehicle | null, fallback: string) {
  if (!vehicle) return fallback
  return vehicle.number || vehicle.StateNumber || vehicle.GarageNumber || vehicle.Name || vehicle.name || fallback
}

async function glonassLogin(): Promise<string | null> {
  if (!USERNAME || !PASSWORD) return null

  try {
    const resp = await fetch(`${BASE_URL}/api/v3/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: USERNAME, password: PASSWORD }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return data.AuthId || data.SessionId || data.token || null
  } catch {
    return null
  }
}

async function glonassLogout(token: string) {
  try {
    await fetch(`${BASE_URL}/api/v3/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth": token,
        AuthId: token,
      },
    })
  } catch {
    // ignore logout failures
  }
}

async function getVehicles(token: string): Promise<GlonassVehicle[]> {
  try {
    const resp = await fetch(`${BASE_URL}/api/vehicles?AuthId=${token}`, {
      headers: { "X-Auth": token, AuthId: token, Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return []
    const data = await resp.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function parseNavPoints(text: string): NavPoint[] {
  const clean = text.replace(/^"|"$/g, "")
  const ampIdx = clean.indexOf("&")
  if (ampIdx === -1) return []

  const basePart = clean.substring(0, ampIdx).replace("Z", "").trim()
  const dataPart = clean.substring(ampIdx + 1)
  if (!dataPart) return []

  const baseDate = new Date(basePart + "Z")
  const points: NavPoint[] = []

  for (const segment of dataPart.split(":")) {
    if (!segment) continue
    const parts = segment.split(",")
    if (parts.length < 3) continue

    const lat = parseFloat(parts[0])
    const lng = parseFloat(parts[1])
    const offsetSec = parseFloat(parts[2])
    const speed = parts.length > 3 ? parseFloat(parts[3]) : 0

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(offsetSec)) continue

    points.push({
      lat,
      lng,
      speed: Number.isFinite(speed) ? speed : 0,
      timestamp: new Date(baseDate.getTime() + offsetSec * 1000).toISOString(),
    })
  }

  return points
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radiusKm = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2

  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function summarizeMovement(points: NavPoint[]): MovementSummary {
  if (points.length < 2) {
    return { moved: false, totalDistance: 0, maxSpeed: 0 }
  }

  let totalDistance = 0
  let maxSpeed = 0

  for (let i = 0; i < points.length; i++) {
    maxSpeed = Math.max(maxSpeed, points[i].speed || 0)
    if (i === 0) continue
    totalDistance += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
  }

  const roundedDistance = Math.round(totalDistance * 100) / 100
  return {
    moved: roundedDistance >= 0.2 || maxSpeed > 3,
    totalDistance: roundedDistance,
    maxSpeed: Math.round(maxSpeed),
  }
}

async function getVehiclePoints(token: string, vehicleId: number, date: string) {
  const dateFrom = new Date(`${date}T00:00:00+07:00`)
  const dateTo = new Date(`${date}T23:59:59+07:00`)
  const params = new URLSearchParams({
    vehicleId: String(vehicleId),
    start: dateFrom.toISOString(),
    end: dateTo.toISOString(),
  })

  const resp = await fetch(`${BASE_URL}/api/history/points?${params.toString()}`, {
    headers: { "X-Auth": token, AuthId: token, Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) return []

  const text = await resp.text()
  if (!text || !text.includes("&")) return []

  return parseNavPoints(text)
}

async function hasMissingDepositNotification(driver: string, date: string) {
  try {
    const [rows] = await pool.execute(
      `SELECT id FROM notifications
       WHERE target_role = 'admin'
         AND type = 'gps_missing_deposit'
         AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.driver')) = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.date')) = ?
       LIMIT 1`,
      [driver, date]
    ) as any

    return rows.length > 0
  } catch {
    const [rows] = await pool.execute(
      `SELECT id FROM notifications
       WHERE target_role = 'admin'
         AND type = 'gps_missing_deposit'
         AND title = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       LIMIT 1`,
      [`Belum Isi Setoran - ${driver}`]
    ) as any

    return rows.length > 0
  }
}

async function createMissingDepositNotification(
  driver: string,
  vehicleName: string,
  date: string,
  movement: MovementSummary
) {
  if (await hasMissingDepositNotification(driver, date)) return false

  const result = await notifyAdmins({
    title: `Belum Isi Setoran - ${driver}`,
    body: `${driver} terdeteksi jalan di GPS hari ini, tapi belum input setoran.`,
    type: "gps_missing_deposit",
    data: {
      driver,
      date,
      vehicle: vehicleName,
      totalDistance: String(movement.totalDistance),
      maxSpeed: String(movement.maxSpeed),
      url: "/deposit",
    },
  })

  return result.logged
}

async function runSync(date: string): Promise<SyncResult> {
  await ensureNotificationsTable()

  const [driverRows] = await pool.execute(
    "SELECT name, vehicle FROM drivers WHERE vehicle IS NOT NULL AND TRIM(vehicle) != ''"
  ) as any
  const [depositRows] = await pool.execute(
    "SELECT DISTINCT driver FROM schedules WHERE date = ?",
    [date]
  ) as any

  const driversWithDeposit = new Set(
    (depositRows || []).map((row: { driver: string }) => normalizeName(row.driver))
  )

  const token = await glonassLogin()
  if (!token) {
    return {
      date,
      driversChecked: driverRows?.length || 0,
      gpsDrivers: 0,
      missingDeposit: 0,
      notificationsCreated: 0,
    }
  }

  let gpsDrivers = 0
  let missingDeposit = 0
  let notificationsCreated = 0

  try {
    const vehicles = await getVehicles(token)

    for (const driverRow of (driverRows || []) as DriverVehicleRow[]) {
      const driverName = String(driverRow.name || "").trim()
      if (!driverName || driversWithDeposit.has(normalizeName(driverName))) continue

      const vehicle = findVehicleByDriverVehicle(vehicles, driverRow.vehicle)
      const numericVehicleId = vehicle?.vehicleId
      if (!vehicle || !numericVehicleId) continue

      const points = await getVehiclePoints(token, numericVehicleId, date)
      const movement = summarizeMovement(points)
      if (!movement.moved) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        continue
      }

      gpsDrivers++
      missingDeposit++

      const created = await createMissingDepositNotification(
        driverName,
        getVehicleDisplayName(vehicle, driverRow.vehicle),
        date,
        movement
      )
      if (created) notificationsCreated++

      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  } finally {
    await glonassLogout(token)
  }

  return {
    date,
    driversChecked: driverRows?.length || 0,
    gpsDrivers,
    missingDeposit,
    notificationsCreated,
  }
}

export async function syncAdminGpsDepositNotifications(options?: { date?: string; force?: boolean }) {
  const date = options?.date || getWibDateString()

  if (
    !options?.force &&
    syncCache &&
    syncCache.date === date &&
    Date.now() - syncCache.timestamp < SYNC_TTL_MS
  ) {
    return syncCache.result
  }

  if (syncInFlight) return syncInFlight

  syncInFlight = runSync(date)
    .then((result) => {
      syncCache = { timestamp: Date.now(), date, result }
      return result
    })
    .finally(() => {
      syncInFlight = null
    })

  return syncInFlight
}
