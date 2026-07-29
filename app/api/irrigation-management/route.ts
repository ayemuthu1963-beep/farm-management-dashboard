import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { PUMP_LITRES_PER_HOUR, cropLitresPerTreePerHour, formatRuntimeMinutes, statusColors, zoneConfigs, zoneOrder, type CropWaterFigure, type IrrigationData, type IrrigationRecord, type IrrigationStatus, type TrendPoint, type Zone, type ZoneFiveDayHistory, type ZoneId } from "@/lib/irrigation-data"

interface MotorRuntimeEntry {
  entry_id?: number
  id?: number
  entry_date: string
  plot: string
  motor_no: number
  valve_no: number
  hours: number
  minutes: number
  total_minutes: number
  source?: string
  remarks?: string | null
  created_at?: string | null
}

interface MergedMotorRuntimeEntry extends MotorRuntimeEntry {
  source_record_count: number
  source_record_ids: number[]
  merged_total_minutes: number
  merged_runtime_display: string
  min_created_at?: string | null
  max_created_at?: string | null
}

const IST_TIME_ZONE = "Asia/Kolkata"

const plotToZone = new Map<string, ZoneId>(zoneOrder.map((id) => [zoneConfigs[id].plot, id]))
plotToZone.set("Nutmeg", "NM")
plotToZone.set("Nutmug", "NM")

function getIsoDateInTimeZone(date = new Date(), timeZone = IST_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addCalendarDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "--"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function formatShortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
}

function getDateBounds(searchParams: URLSearchParams): { startDate?: string; endDate?: string; label: string } {
  const period = searchParams.get("period") ?? "last7"
  const today = getIsoDateInTimeZone()
  const yesterday = addCalendarDays(today, -1)
  if (period === "custom") {
    const startDate = searchParams.get("startDate") ?? undefined
    const endDate = searchParams.get("endDate") ?? undefined
    if (startDate && endDate && startDate > endDate) throw new Error("Start date cannot be after end date")
    return { startDate, endDate, label: startDate && endDate ? `${startDate} to ${endDate}` : "Custom range" }
  }
  if (period === "cycle") return { label: "Current Irrigation Cycle" }
  if (period === "today") {
    return { startDate: today, endDate: today, label: "Today" }
  }
  if (period === "yesterday") {
    return { startDate: yesterday, endDate: yesterday, label: "Yesterday" }
  }
  return { startDate: addCalendarDays(yesterday, -6), endDate: yesterday, label: "Last 7 Days" }
}

function isWithinRange(entryDate: string, startDate?: string, endDate?: string): boolean {
  if (startDate && entryDate < startDate) return false
  if (endDate && entryDate > endDate) return false
  return true
}

function runtimeWater(totalMinutes: number): number { return Math.round((totalMinutes / 60) * PUMP_LITRES_PER_HOUR) }

function cropWaterFigure(zoneId: ZoneId, totalMinutes: number): CropWaterFigure {
  const crop = zoneConfigs[zoneId].crop
  return { crop, litresPerTree: Math.round((totalMinutes / 60) * cropLitresPerTreePerHour[crop]) }
}

function getFiveDayWindow(endDate?: string): string[] {
  const finalDate = endDate ?? addCalendarDays(getIsoDateInTimeZone(), -1)
  return Array.from({ length: 5 }, (_, index) => addCalendarDays(finalDate, -index))
}

function getEntryId(entry: MotorRuntimeEntry): number | undefined {
  return entry.entry_id ?? entry.id
}

function mergeRemarks(remarks: Array<string | null | undefined>): string {
  const seen = new Set<string>()
  const merged: string[] = []
  for (const value of remarks) {
    const text = value?.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    merged.push(text)
  }
  return merged.join(" | ")
}

function mergeSources(sources: Array<string | null | undefined>): string {
  const distinct = Array.from(new Set(sources.map((source) => source?.trim()).filter(Boolean) as string[]))
  return distinct.length > 0 ? distinct.join(" | ") : "Motor Runtime"
}

function mergeEntries(entries: MotorRuntimeEntry[]): MergedMotorRuntimeEntry[] {
  const groups = new Map<string, { entries: MotorRuntimeEntry[] }>()
  for (const entry of entries) {
    const key = `${entry.entry_date}|${entry.motor_no}|${entry.valve_no}|${entry.plot}`
    const group = groups.get(key) ?? { entries: [] }
    group.entries.push(entry)
    groups.set(key, group)
  }

  return Array.from(groups.values()).map(({ entries }) => {
    const ordered = [...entries].sort((a, b) => {
      const aCreated = a.created_at ?? ""
      const bCreated = b.created_at ?? ""
      return aCreated.localeCompare(bCreated) || (getEntryId(a) ?? 0) - (getEntryId(b) ?? 0)
    })
    const first = ordered[0]
    const totalMinutes = ordered.reduce((sum, entry) => sum + Number(entry.total_minutes ?? 0), 0)
    const ids = ordered.map(getEntryId).filter((id): id is number => typeof id === "number").sort((a, b) => a - b)
    const createdValues = ordered.map((entry) => entry.created_at).filter((value): value is string => Boolean(value))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return {
      ...first,
      entry_id: ids[0] ?? first.entry_id,
      id: ids[0] ?? first.id,
      hours,
      minutes,
      total_minutes: totalMinutes,
      source: mergeSources(ordered.map((entry) => entry.source)),
      remarks: mergeRemarks(ordered.map((entry) => entry.remarks)),
      source_record_count: ordered.length,
      source_record_ids: ids,
      merged_total_minutes: totalMinutes,
      merged_runtime_display: formatRuntimeMinutes(totalMinutes),
      min_created_at: createdValues.length > 0 ? createdValues[0] : null,
      max_created_at: createdValues.length > 0 ? createdValues.at(-1) : null,
    }
  }).sort((a, b) => {
    return b.entry_date.localeCompare(a.entry_date) || a.motor_no - b.motor_no || a.valve_no - b.valve_no || a.plot.localeCompare(b.plot) || (a.min_created_at ?? "").localeCompare(b.min_created_at ?? "")
  })
}

function buildRecord(entry: MergedMotorRuntimeEntry, zoneId: ZoneId): IrrigationRecord {
  const config = zoneConfigs[zoneId]
  const cropWater = cropWaterFigure(zoneId, entry.total_minutes)
  return {
    id: `${entry.entry_date}-${entry.motor_no}-${entry.valve_no}-${entry.plot}`,
    date: entry.entry_date,
    displayDate: formatDate(entry.entry_date),
    zoneId,
    zoneName: config.name,
    crop: config.crop,
    plot: entry.plot,
    motorNo: entry.motor_no,
    valveNo: entry.valve_no,
    motor: `Motor ${entry.motor_no}`,
    valve: `Valve ${entry.valve_no}`,
    runtimeMinutes: entry.total_minutes,
    runtimeDisplay: formatRuntimeMinutes(entry.total_minutes),
    totalWaterLitres: runtimeWater(entry.total_minutes),
    waterPerTreeLitres: cropWater.litresPerTree,
    source: entry.source ?? "Motor Runtime",
    remarks: entry.remarks ?? "",
    sourceRecordCount: entry.source_record_count,
    sourceRecordIds: entry.source_record_ids,
    mergedTotalMinutes: entry.merged_total_minutes,
    mergedRuntimeDisplay: entry.merged_runtime_display,
  }
}

function buildFiveDayHistory(entries: MotorRuntimeEntry[], historyDates: string[]): Record<ZoneId, ZoneFiveDayHistory[]> {
  const mergedEntries = mergeEntries(entries)
  const today = getIsoDateInTimeZone()
  const minutesByZoneAndDate = new Map<ZoneId, Map<string, number>>()
  for (const id of zoneOrder) minutesByZoneAndDate.set(id, new Map<string, number>())

  for (const entry of mergedEntries) {
    const zoneId = plotToZone.get(entry.plot)
    if (!zoneId || !historyDates.includes(entry.entry_date)) continue
    const dateMap = minutesByZoneAndDate.get(zoneId) ?? new Map<string, number>()
    dateMap.set(entry.entry_date, (dateMap.get(entry.entry_date) ?? 0) + entry.total_minutes)
    minutesByZoneAndDate.set(zoneId, dateMap)
  }

  return Object.fromEntries(zoneOrder.map((zoneId) => {
    const crop = zoneConfigs[zoneId].crop
    const dateMap = minutesByZoneAndDate.get(zoneId) ?? new Map<string, number>()
    const history = historyDates.map((date) => {
      const totalMinutes = dateMap.get(date) ?? 0
      const perTreeLitres = totalMinutes > 0 ? Math.round((totalMinutes / 60) * cropLitresPerTreePerHour[crop]) : null
      return {
        date,
        displayDate: formatShortDate(date),
        totalMinutes,
        perTreeLitres,
        status: totalMinutes > 0 ? "Irrigated" : "No Record",
        isCurrentIncompleteDay: date === today,
      } satisfies ZoneFiveDayHistory
    })
    return [zoneId, history]
  })) as Record<ZoneId, ZoneFiveDayHistory[]>
}

function buildData(entries: MotorRuntimeEntry[], label: string, fiveDayHistory: Record<ZoneId, ZoneFiveDayHistory[]>): IrrigationData {
  const mergedEntries = mergeEntries(entries)
  const byZone = new Map<ZoneId, MergedMotorRuntimeEntry[]>()
  const minutesByDate = new Map<string, Map<ZoneId, number>>()
  for (const id of zoneOrder) byZone.set(id, [])
  const records: IrrigationRecord[] = []

  for (const entry of mergedEntries) {
    const zoneId = plotToZone.get(entry.plot)
    if (!zoneId) continue
    byZone.get(zoneId)?.push(entry)
    records.push(buildRecord(entry, zoneId))
    const dateMap = minutesByDate.get(entry.entry_date) ?? new Map<ZoneId, number>()
    dateMap.set(zoneId, (dateMap.get(zoneId) ?? 0) + entry.total_minutes)
    minutesByDate.set(entry.entry_date, dateMap)
  }

  let totalMinutes = 0
  let totalWaterSupplied = 0
  let latestIrrigation: string | null = null

  const zones: Zone[] = zoneOrder.map((zoneId) => {
    const config = zoneConfigs[zoneId]
    const zoneEntries = byZone.get(zoneId) ?? []
    const zoneMinutes = zoneEntries.reduce((sum, entry) => sum + entry.total_minutes, 0)
    const totalWater = runtimeWater(zoneMinutes)
    const motors = Array.from(new Set(zoneEntries.map((entry) => `Motor ${entry.motor_no} Valve ${entry.valve_no}`))).sort()
    const lastEntryDate = zoneEntries.map((entry) => entry.entry_date).sort().at(-1)
    const cropWater = cropWaterFigure(zoneId, zoneMinutes)
    const status: IrrigationStatus = zoneMinutes > 0 ? "irrigated" : "no-record"
    totalMinutes += zoneMinutes
    totalWaterSupplied += totalWater
    if (lastEntryDate && (!latestIrrigation || lastEntryDate > latestIrrigation)) latestIrrigation = lastEntryDate
    return { ...config, motor: motors.length > 0 ? motors.join(", ") : config.configuredMotorValves.join(", "), valveOpenTime: zoneMinutes > 0 ? formatRuntimeMinutes(zoneMinutes) : "--", totalRuntimeMinutes: zoneMinutes, totalRuntimeHours: Number((zoneMinutes / 60).toFixed(2)), totalWaterSupplied: totalWater, waterPerTree: cropWater.litresPerTree, waterPerTreeDisplay: zoneMinutes > 0 ? `${cropWater.crop}: ${cropWater.litresPerTree.toLocaleString("en-IN")} L/tree/hour equivalent` : "No runtime recorded", cropWater: [cropWater], lastIrrigatedDate: formatDate(lastEntryDate), daysSinceIrrigation: null, recordsCount: zoneEntries.length, status, statusLabel: statusColors[status].label, fiveDayHistory: fiveDayHistory[zoneId] ?? [] }
  })

  const perTreeTrendKey: Record<ZoneId, "P1EPerTree" | "P1WPerTree" | "P2EPerTree" | "P2WPerTree" | "JFPerTree" | "NMPerTree"> = {
    P1E: "P1EPerTree",
    P1W: "P1WPerTree",
    P2E: "P2EPerTree",
    P2W: "P2WPerTree",
    JF: "JFPerTree",
    NM: "NMPerTree",
  }

  const trend: TrendPoint[] = Array.from(minutesByDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, dateMinutes]) => {
    const point: TrendPoint = {
      date,
      displayDate: formatShortDate(date),
      totalWaterLitres: 0,
      totalRuntimeHours: 0,
      P1E: 0,
      P1W: 0,
      P2E: 0,
      P2W: 0,
      JF: 0,
      NM: 0,
      P1EPerTree: 0,
      P1WPerTree: 0,
      P2EPerTree: 0,
      P2WPerTree: 0,
      JFPerTree: 0,
      NMPerTree: 0,
    }
    for (const zoneId of zoneOrder) {
      const minutes = dateMinutes.get(zoneId) ?? 0
      point[zoneId] = runtimeWater(minutes)
      point[perTreeTrendKey[zoneId]] = cropWaterFigure(zoneId, minutes).litresPerTree
      point.totalWaterLitres += point[zoneId]
      point.totalRuntimeHours += minutes / 60
    }
    point.totalRuntimeHours = Number(point.totalRuntimeHours.toFixed(2))
    return point
  })

  const irrigatedZones = zones.filter((zone) => zone.totalRuntimeMinutes > 0)
  const averageWaterPerTree = irrigatedZones.length > 0 ? Math.round(irrigatedZones.reduce((sum, zone) => sum + zone.waterPerTree, 0) / irrigatedZones.length) : 0
  records.sort((a, b) => b.date.localeCompare(a.date) || a.zoneId.localeCompare(b.zoneId) || a.motorNo - b.motorNo)

  return { selectedPeriodLabel: label, generatedAt: new Date().toISOString(), source: "live", summary: { totalWaterSupplied, totalMotorRuntime: formatRuntimeMinutes(totalMinutes), totalMotorRuntimeMinutes: totalMinutes, zonesIrrigated: irrigatedZones.length, zonesNotIrrigated: zoneOrder.length - irrigatedZones.length, averageWaterPerTree, latestIrrigation: formatDate(latestIrrigation) }, zones, records, trend }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  try {
    const { startDate, endDate, label } = getDateBounds(searchParams)
    const historyDates = getFiveDayWindow(endDate)
    const historyStartDate = historyDates.at(-1)
    const historyEndDate = historyDates[0]
    const headers: HeadersInit = {}
    const authHeader = getBasicAuthHeader()
    if (authHeader) headers.Authorization = authHeader
    const buildUpstreamParams = (rangeStart?: string, rangeEnd?: string) => {
      const upstreamParams = new URLSearchParams({ limit: "100" })
      if (rangeStart) upstreamParams.set("start_date", rangeStart)
      if (rangeEnd) upstreamParams.set("end_date", rangeEnd)
      return upstreamParams
    }
    const selectedParams = buildUpstreamParams(startDate, endDate)
    const historyParams = buildUpstreamParams(historyStartDate, historyEndDate)
    const [selectedResponse, historyResponse] = await Promise.all([
      fetch(`${getApiBaseUrl()}/api/motor-runtime/entries?${selectedParams.toString()}`, { headers, cache: "no-store" }),
      fetch(`${getApiBaseUrl()}/api/motor-runtime/entries?${historyParams.toString()}`, { headers, cache: "no-store" }),
    ])
    if (!selectedResponse.ok) throw new Error(`Motor Runtime API returned ${selectedResponse.status}`)
    if (!historyResponse.ok) throw new Error(`Motor Runtime history API returned ${historyResponse.status}`)
    const selectedRows = (await selectedResponse.json()) as MotorRuntimeEntry[]
    const historyRows = (await historyResponse.json()) as MotorRuntimeEntry[]
    const fiveDayHistory = buildFiveDayHistory(historyRows.filter((row) => isWithinRange(row.entry_date, historyStartDate, historyEndDate)), historyDates)
    return NextResponse.json(buildData(selectedRows.filter((row) => isWithinRange(row.entry_date, startDate, endDate)), label, fiveDayHistory), { headers: { "Cache-Control": "no-store, max-age=0" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch irrigation data"
    return NextResponse.json({ error: message }, { status: message === "Start date cannot be after end date" ? 400 : 503, headers: { "Cache-Control": "no-store, max-age=0" } })
  }
}
