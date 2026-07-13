import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import type { CropWaterFigure, IrrigationData, IrrigationStatus, Zone, ZoneId } from "@/lib/irrigation-data"
import { statusColors, zoneNames } from "@/lib/irrigation-data"

const PUMP_LITRES_PER_HOUR = 50_000

const zoneMappings: Array<{
  id: ZoneId
  plot: string
  crops: CropWaterFigure["crop"][]
}> = [
  { id: "P1E", plot: "Plot1_East", crops: ["Coconut", "Nutmeg"] },
  { id: "P1W", plot: "Plot1_West", crops: ["Coconut", "Nutmeg"] },
  { id: "P2E", plot: "Plot2_East", crops: ["Coconut"] },
  { id: "P2W", plot: "Plot2_West", crops: ["Coconut"] },
  { id: "JF", plot: "Jack_Fruit", crops: ["Jackfruit"] },
]

const cropLitresPerHour: Record<CropWaterFigure["crop"], number> = {
  Coconut: 100,
  Nutmeg: 80,
  Jackfruit: 60,
}

interface MotorRuntimeEntry {
  entry_date: string
  plot: string
  motor_no: number
  valve_no: number
  hours: number
  minutes: number
  total_minutes: number
  created_at?: string
}

function formatRuntime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours} h ${minutes} m`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "--"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function getDateBounds(searchParams: URLSearchParams): { startDate?: string; endDate?: string; label: string } {
  const period = searchParams.get("period") ?? "last7"
  const today = new Date()
  const toIso = (date: Date) => date.toISOString().slice(0, 10)

  if (period === "custom") {
    const startDate = searchParams.get("startDate") ?? undefined
    const endDate = searchParams.get("endDate") ?? undefined
    return { startDate, endDate, label: startDate && endDate ? `${startDate} to ${endDate}` : "Custom range" }
  }

  if (period === "today") {
    const date = toIso(today)
    return { startDate: date, endDate: date, label: "Today" }
  }

  if (period === "yesterday") {
    const date = new Date(today)
    date.setDate(date.getDate() - 1)
    const iso = toIso(date)
    return { startDate: iso, endDate: iso, label: "Yesterday" }
  }

  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 6)
  return { startDate: toIso(startDate), endDate: toIso(today), label: "Last 7 Days" }
}

function isWithinRange(entryDate: string, startDate?: string, endDate?: string): boolean {
  if (startDate && entryDate < startDate) return false
  if (endDate && entryDate > endDate) return false
  return true
}

function cropWaterFigures(crops: CropWaterFigure["crop"][], totalMinutes: number): CropWaterFigure[] {
  const runtimeHours = totalMinutes / 60
  return crops.map((crop) => ({
    crop,
    litresPerTree: Math.round(runtimeHours * cropLitresPerHour[crop]),
  }))
}

function waterPerTreeDisplay(figures: CropWaterFigure[]): string {
  if (figures.length === 0) return "--"
  return figures.map((figure) => `${figure.crop}: ${figure.litresPerTree.toLocaleString("en-IN")} L/tree`).join(" | ")
}

function buildData(entries: MotorRuntimeEntry[], label: string): IrrigationData {
  const byZone = new Map<ZoneId, MotorRuntimeEntry[]>()
  const byDate = new Map<string, Map<ZoneId, number>>()

  for (const mapping of zoneMappings) {
    byZone.set(mapping.id, [])
  }

  for (const entry of entries) {
    const mapping = zoneMappings.find((item) => item.plot === entry.plot)
    if (!mapping) continue
    byZone.get(mapping.id)?.push(entry)

    const dateMap = byDate.get(entry.entry_date) ?? new Map<ZoneId, number>()
    dateMap.set(mapping.id, (dateMap.get(mapping.id) ?? 0) + entry.total_minutes)
    byDate.set(entry.entry_date, dateMap)
  }

  let totalMinutes = 0
  let totalWaterSupplied = 0
  let latestIrrigation: string | null = null

  const zones: Zone[] = zoneMappings.map((mapping) => {
    const zoneEntries = byZone.get(mapping.id) ?? []
    const zoneMinutes = zoneEntries.reduce((sum, entry) => sum + entry.total_minutes, 0)
    const zoneWater = Math.round((zoneMinutes / 60) * PUMP_LITRES_PER_HOUR)
    const motors = Array.from(new Set(zoneEntries.map((entry) => `M${entry.motor_no} / Valve${entry.valve_no}`)))
    const lastEntryDate = zoneEntries.map((entry) => entry.entry_date).sort().at(-1)
    const cropWater = cropWaterFigures(mapping.crops, zoneMinutes)
    const status: IrrigationStatus = zoneMinutes > 0 ? "target" : "no-data"

    totalMinutes += zoneMinutes
    totalWaterSupplied += zoneWater
    if (lastEntryDate && (!latestIrrigation || lastEntryDate > latestIrrigation)) {
      latestIrrigation = lastEntryDate
    }

    return {
      id: mapping.id,
      name: zoneNames[mapping.id],
      plot: mapping.plot,
      motor: motors.length > 0 ? motors.join(", ") : "--",
      valveOpenTime: zoneMinutes > 0 ? formatRuntime(zoneMinutes) : "--",
      totalWaterSupplied: zoneWater,
      waterPerTree: cropWater[0]?.litresPerTree ?? 0,
      waterPerTreeDisplay: waterPerTreeDisplay(cropWater),
      cropWater,
      lastIrrigatedDate: formatDate(lastEntryDate),
      daysSinceIrrigation: null,
      recordsCount: zoneEntries.length,
      status,
      statusLabel: statusColors[status].label,
    }
  })

  const waterPerTreeTrend = Array.from(byDate.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, minutesByZone]) => {
      const point = {
        date: formatDate(date),
        P1E: 0,
        P1W: 0,
        P2E: 0,
        P2W: 0,
        JF: 0,
      }

      for (const mapping of zoneMappings) {
        const minutes = minutesByZone.get(mapping.id) ?? 0
        const figures = cropWaterFigures(mapping.crops, minutes)
        point[mapping.id] = figures[0]?.litresPerTree ?? 0
      }

      return point
    })

  const source = entries[0]
  const sourceMapping = source ? zoneMappings.find((mapping) => mapping.plot === source.plot) : undefined

  return {
    selectedPeriodLabel: label,
    summary: {
      totalWaterSupplied,
      totalMotorRuntime: formatRuntime(totalMinutes),
      zonesIrrigated: zones.filter((zone) => zone.totalWaterSupplied > 0).length,
      latestIrrigation: formatDate(latestIrrigation),
    },
    zones,
    waterPerTreeTrend,
    sourceRecord:
      source && sourceMapping
        ? {
            entryDate: source.entry_date,
            plot: source.plot,
            motorNo: source.motor_no,
            valveNo: source.valve_no,
            hours: source.hours,
            minutes: source.minutes,
            totalMinutes: source.total_minutes,
            totalWaterLitres: Math.round((source.total_minutes / 60) * PUMP_LITRES_PER_HOUR),
            waterPerTree: cropWaterFigures(sourceMapping.crops, source.total_minutes),
          }
        : undefined,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const { startDate, endDate, label } = getDateBounds(searchParams)

  try {
    const headers: HeadersInit = {}
    const authHeader = getBasicAuthHeader()
    if (authHeader) {
      headers.Authorization = authHeader
    }

    const response = await fetch(`${getApiBaseUrl()}/api/motor-runtime/entries?limit=100`, {
      headers,
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`Motor Runtime API returned ${response.status}`)
    }

    const rows = (await response.json()) as MotorRuntimeEntry[]
    const filteredRows = rows.filter((row) => isWithinRange(row.entry_date, startDate, endDate))

    return NextResponse.json(buildData(filteredRows, label))
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch irrigation data",
      },
      { status: 503 },
    )
  }
}
