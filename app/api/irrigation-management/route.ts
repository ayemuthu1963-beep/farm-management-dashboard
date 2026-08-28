import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { cropLitresPerTreePerHour, formatRuntimeMinutes, statusColors, zoneConfigs, zoneOrder, type CropWaterFigure, type IrrigationData, type IrrigationRecord, type IrrigationStatus, type TrendPoint, type Zone, type ZoneFiveDayHistory, type ZoneId } from "@/lib/irrigation-data"
import { buildRecentIrrigationHistory } from "@/lib/irrigation-history"
import {
  getIrrigationDateBounds,
  getRecentIrrigationHistoryDates,
  IRRIGATION_PERIOD_VALIDATION_ERRORS,
  resolveIrrigationDateBounds,
  shiftIsoDate,
} from "@/lib/irrigation-period"
import { fetchAllMotorRuntimeEntries } from "@/lib/irrigation-upstream"
import { pumpedLitresForRuntimeMinutes } from "@/lib/water-pump-rates"
import { fetchPublicMotorNoRunRecords } from "@/lib/motor-no-run-server"
import type { PublicMotorNoRunRecord } from "@/lib/motor-data"

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

const plotToZone = new Map<string, ZoneId>(zoneOrder.map((id) => [zoneConfigs[id].plot, id]))
plotToZone.set("Nutmeg", "NM")
plotToZone.set("Nutmug", "NM")

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

function isWithinRange(entryDate: string, startDate?: string, endDate?: string): boolean {
  if (startDate && entryDate < startDate) return false
  if (endDate && entryDate > endDate) return false
  return true
}

function getSelectedDates(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  for (let date = startDate; date <= endDate; date = shiftIsoDate(date, 1)) dates.push(date)
  return dates
}

function runtimeWater(totalMinutes: number, zoneId: ZoneId): number {
  return pumpedLitresForRuntimeMinutes(totalMinutes, zoneConfigs[zoneId].plot)
}

function cropWaterFigure(zoneId: ZoneId, totalMinutes: number): CropWaterFigure {
  const crop = zoneConfigs[zoneId].crop
  return { crop, litresPerTree: Math.round((totalMinutes / 60) * cropLitresPerTreePerHour[crop]) }
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
    totalWaterLitres: runtimeWater(entry.total_minutes, zoneId),
    waterPerTreeLitres: cropWater.litresPerTree,
    source: entry.source ?? "Motor Runtime",
    remarks: entry.remarks ?? "",
    sourceRecordCount: entry.source_record_count,
    sourceRecordIds: entry.source_record_ids,
    mergedTotalMinutes: entry.merged_total_minutes,
    mergedRuntimeDisplay: entry.merged_runtime_display,
  }
}

function buildData(
  entries: MotorRuntimeEntry[],
  noRunRecords: readonly PublicMotorNoRunRecord[],
  label: string,
  fiveDayHistory: Record<ZoneId, ZoneFiveDayHistory[]>,
  startDate: string,
  endDate: string,
): IrrigationData {
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
    const totalWater = runtimeWater(zoneMinutes, zoneId)
    const motors = Array.from(new Set(zoneEntries.map((entry) => `Motor ${entry.motor_no} Valve ${entry.valve_no}`))).sort()
    const lastEntryDate = zoneEntries.map((entry) => entry.entry_date).sort().at(-1)
    const cropWater = cropWaterFigure(zoneId, zoneMinutes)
    const status: IrrigationStatus = zoneMinutes > 0 ? "irrigated" : "no-record"
    totalMinutes += zoneMinutes
    totalWaterSupplied += totalWater
    if (lastEntryDate && (!latestIrrigation || lastEntryDate > latestIrrigation)) latestIrrigation = lastEntryDate
    return { ...config, motor: motors.length > 0 ? motors.join(", ") : config.configuredMotorValves.join(", "), valveOpenTime: zoneMinutes > 0 ? formatRuntimeMinutes(zoneMinutes) : "--", totalRuntimeMinutes: zoneMinutes, totalRuntimeHours: Number((zoneMinutes / 60).toFixed(2)), totalWaterSupplied: totalWater, waterPerTree: cropWater.litresPerTree, waterPerTreeDisplay: zoneMinutes > 0 ? `${cropWater.crop}: ${cropWater.litresPerTree.toLocaleString("en-IN")} L/tree/hour equivalent` : "No runtime recorded", cropWater: [cropWater], lastIrrigatedDate: formatDate(lastEntryDate), daysSinceIrrigation: null, recordsCount: zoneEntries.length, status, statusLabel: statusColors[status].label, fiveDayHistory: fiveDayHistory[zoneId] ?? [] }
  })

  const trend: TrendPoint[] = getSelectedDates(startDate, endDate).map((date) => {
    const dateMinutes = minutesByDate.get(date)
    if (!dateMinutes || dateMinutes.size === 0) {
      return { date, displayDate: formatShortDate(date), totalWaterLitres: null, totalRuntimeHours: null, P1E: null, P1W: null, P2E: null, P2W: null, JF: null, NM: null }
    }
    const point: TrendPoint = { date, displayDate: formatShortDate(date), totalWaterLitres: 0, totalRuntimeHours: 0, P1E: null, P1W: null, P2E: null, P2W: null, JF: null, NM: null }
    for (const zoneId of zoneOrder) {
      const minutes = dateMinutes.get(zoneId)
      if (minutes === undefined) continue
      point[zoneId] = cropWaterFigure(zoneId, minutes).litresPerTree
      point.totalWaterLitres = (point.totalWaterLitres ?? 0) + runtimeWater(minutes, zoneId)
      point.totalRuntimeHours = (point.totalRuntimeHours ?? 0) + minutes / 60
    }
    point.totalRuntimeHours = Number((point.totalRuntimeHours ?? 0).toFixed(2))
    return point
  })

  const irrigatedZones = zones.filter((zone) => zone.totalRuntimeMinutes > 0)
  const averageWaterPerTree = irrigatedZones.length > 0 ? Math.round(irrigatedZones.reduce((sum, zone) => sum + zone.waterPerTree, 0) / irrigatedZones.length) : 0
  records.sort((a, b) => b.date.localeCompare(a.date) || a.zoneId.localeCompare(b.zoneId) || a.motorNo - b.motorNo)

  return { selectedPeriodLabel: label, generatedAt: new Date().toISOString(), source: "live", summary: { totalWaterSupplied, totalMotorRuntime: formatRuntimeMinutes(totalMinutes), totalMotorRuntimeMinutes: totalMinutes, zonesIrrigated: irrigatedZones.length, zonesNotIrrigated: zoneOrder.length - irrigatedZones.length, averageWaterPerTree, latestIrrigation: formatDate(latestIrrigation) }, zones, records, trend, motorNoRunRecords: [...noRunRecords] }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  try {
    const { startDate, endDate, label } = resolveIrrigationDateBounds(searchParams)
    const historyDates = getRecentIrrigationHistoryDates(endDate)
    const historyStartDate = historyDates.at(-1)
    const historyEndDate = historyDates[0]
    if (!historyStartDate || !historyEndDate) throw new Error("Unable to resolve irrigation history dates")
    const headers: HeadersInit = {}
    const authHeader = getBasicAuthHeader()
    if (authHeader) headers.Authorization = authHeader
    const baseUrl = getApiBaseUrl()
    const noRunStartDate = historyStartDate < startDate ? historyStartDate : startDate
    const noRunEndDate = historyEndDate > endDate ? historyEndDate : endDate
    const [selectedRows, historyRows, noRunRecords] = await Promise.all([
      fetchAllMotorRuntimeEntries<MotorRuntimeEntry>({
        baseUrl,
        startDate,
        endDate,
        headers,
        responseLabel: "Motor Runtime API",
      }),
      fetchAllMotorRuntimeEntries<MotorRuntimeEntry>({
        baseUrl,
        startDate: historyStartDate,
        endDate: historyEndDate,
        headers,
        responseLabel: "Motor Runtime history API",
      }),
      fetchPublicMotorNoRunRecords({ baseUrl, startDate: noRunStartDate, endDate: noRunEndDate, headers }),
    ])
    const litresPerTreePerHourByZone = Object.fromEntries(zoneOrder.map((zoneId) => [
      zoneId,
      cropLitresPerTreePerHour[zoneConfigs[zoneId].crop],
    ])) as Record<ZoneId, number>
    const fiveDayHistory = buildRecentIrrigationHistory({
      entries: historyRows.filter((row) => isWithinRange(row.entry_date, historyStartDate, historyEndDate)),
      historyDates,
      zoneIds: zoneOrder,
      zoneByPlot: plotToZone,
      litresPerTreePerHourByZone,
      today: getIrrigationDateBounds("today").startDate,
    })
    return NextResponse.json(buildData(
      selectedRows.filter((row) => isWithinRange(row.entry_date, startDate, endDate)),
      noRunRecords,
      label,
      fiveDayHistory,
      startDate,
      endDate,
    ), { headers: { "Cache-Control": "no-store, max-age=0" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch irrigation data"
    const isBadRequest = IRRIGATION_PERIOD_VALIDATION_ERRORS.includes(message as typeof IRRIGATION_PERIOD_VALIDATION_ERRORS[number])
    return NextResponse.json({ error: message }, { status: isBadRequest ? 400 : 503, headers: { "Cache-Control": "no-store, max-age=0" } })
  }
}
