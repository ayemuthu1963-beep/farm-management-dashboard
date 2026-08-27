import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { pumpedLitresForRuntimeMinutes } from "@/lib/water-pump-rates"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type MotorId = "M1" | "M2" | "M3"

type RuntimeEntry = {
  id: string
  entry_date: string
  plot: string
  motor_no: number
  valve_no: number
  hours: number
  minutes: number
  total_minutes: number
  remarks: string | null
  source: string
  created_at: string
  record_type?: "legacy" | "managed"
  session_id?: number | null
  motor_on_at?: string | null
  motor_off_at?: string | null
  run_no?: number | null
}

type NoRunRecord = {
  id: number
  operation_date: string
  motor_id: "motor-1" | "motor-2" | "motor-3"
  status: "Not Run"
  reason: string
  remarks: string | null
  source: "Manual_Admin"
  entered_by: string
  created_at: string
}

const motorIds: MotorId[] = ["M1", "M2", "M3"]
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const FARM_TIME_ZONE = "Asia/Kolkata"
const plotLabels: Record<string, string> = {
  Plot2_East: "Plot 2 East",
  Plot2_West: "Plot 2 West",
  Plot1_East: "Plot 1 East",
  Plot1_West: "Plot 1 West",
  Nutmug: "Nutmeg",
  Jack_Fruit: "Jackfruit",
}

function motorId(motorNo: number): MotorId {
  return `M${motorNo}` as MotorId
}

function displayDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00+05:30`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-GB", { timeZone: FARM_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" })
}

function displayedDateSortKey(value: string): string {
  const [day, month, year] = value.split("/")
  return year && month && day ? `${year}-${month}-${day}` : value
}

function farmTodayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FARM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  return `${year}-${month}-${day}`
}

function shiftIsoDate(isoDate: string, offsetDays: number): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10)
}

function selectedDateKeys(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  for (let date = startDate; date <= endDate; date = shiftIsoDate(date, 1)) dates.push(date)
  return dates
}

function runtimeHours(totalMinutes: number): number {
  return Math.round((totalMinutes / 60) * 100) / 100
}

function runtimeDisplay(hours: number, minutes: number): string {
  return `${hours} h ${minutes} m`
}

function validateRange(startDate: string | null, endDate: string | null): string | null {
  if (!startDate) return "Start Date is required."
  if (!endDate) return "End Date is required."
  if (!ISO_DATE_PATTERN.test(startDate)) return "Start Date is not valid."
  if (!ISO_DATE_PATTERN.test(endDate)) return "End Date is not valid."
  if (startDate > endDate) return "Start Date cannot be after End Date."
  const today = farmTodayIso()
  if (startDate > today || endDate > today) return "Future dates are not allowed."
  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get("start_date")
  const endDate = searchParams.get("end_date")
  const rangeError = validateRange(startDate, endDate)
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ error: "Harvest API credentials are not configured" }, { status: 503 })
  }

  try {
    const backendQuery = new URLSearchParams({
      limit: "1000",
      start_date: startDate ?? "",
      end_date: endDate ?? "",
    })
    const headers = { Authorization: authHeader, Accept: "application/json" }
    const noRunQuery = new URLSearchParams({ start_date: startDate ?? "", end_date: endDate ?? "" })
    const [response, noRunResponse] = await Promise.all([
      fetch(`${getApiBaseUrl()}/api/motor-runtime/entries?${backendQuery}`, { headers, cache: "no-store" }),
      fetch(`${getApiBaseUrl()}/api/motor-runtime/management/no-run-records?${noRunQuery}`, { headers, cache: "no-store" }),
    ])

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      return NextResponse.json(payload, { status: response.status })
    }
    if (!noRunResponse.ok && noRunResponse.status !== 404) {
      const payload = await noRunResponse.json().catch(() => ({}))
      return NextResponse.json(payload, { status: noRunResponse.status })
    }

    const entries = (await response.json()) as RuntimeEntry[]
    const noRunRecords = noRunResponse.ok ? (await noRunResponse.json()) as NoRunRecord[] : []
    const sortedEntries = [...entries].sort(
      (a, b) =>
        b.entry_date.localeCompare(a.entry_date) ||
        a.motor_no - b.motor_no ||
        a.valve_no - b.valve_no ||
        (plotLabels[a.plot] ?? a.plot).localeCompare(plotLabels[b.plot] ?? b.plot) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    )
    const entriesByMotor = new Map<MotorId, RuntimeEntry[]>()
    for (const id of motorIds) entriesByMotor.set(id, [])
    for (const entry of sortedEntries) entriesByMotor.get(motorId(entry.motor_no))?.push(entry)

    const countedSessions = new Set<number>()
    const recordsByMotor = Object.fromEntries(
      motorIds.map((id) => [
        id,
        [
          ...(entriesByMotor.get(id) ?? []).map((entry) => {
          const firstAllocation = entry.session_id == null || !countedSessions.has(entry.session_id)
          if (entry.session_id != null) countedSessions.add(entry.session_id)
          return {
            date: displayDate(entry.entry_date),
            runHours: runtimeHours(entry.total_minutes),
            starts: firstAllocation ? 1 : 0,
            energyUnits: 0,
            waterLifted: pumpedLitresForRuntimeMinutes(entry.total_minutes, entry.plot),
            remarks: entry.remarks ?? "",
            plot: plotLabels[entry.plot] ?? entry.plot,
            valve: `Valve${entry.valve_no}`,
            source: entry.source,
          }
          }),
          ...noRunRecords.filter((record) => motorId(Number(record.motor_id.slice(-1))) === id).map((record) => ({
            date: displayDate(record.operation_date),
            runHours: 0,
            starts: 0,
            energyUnits: 0,
            waterLifted: 0,
            remarks: `Not run — ${record.reason}`,
            plot: "—",
            valve: "—",
            source: record.source,
            status: record.status,
            enteredBy: record.entered_by,
            auditTimestamp: record.created_at,
          })),
        ].sort((a, b) => displayedDateSortKey(b.date).localeCompare(displayedDateSortKey(a.date))),
      ]),
    )

    const summaryStats = motorIds.flatMap((id) => {
      const rows = entriesByMotor.get(id) ?? []
      const totalMinutes = rows.reduce((sum, entry) => sum + entry.total_minutes, 0)
      const totalWaterPumped = rows.reduce(
        (sum, entry) => sum + pumpedLitresForRuntimeMinutes(entry.total_minutes, entry.plot),
        0,
      )
      return [
        { motor: `Motor ${id.slice(1)}`, motorId: id, label: "Total Run Hours", value: runtimeHours(totalMinutes), unit: "Hours", icon: "clock" },
        {
          motor: `Motor ${id.slice(1)}`,
          motorId: id,
          label: "Total Starts",
          value: new Set(rows.map((entry) => entry.session_id == null ? `legacy-${entry.id}` : `session-${entry.session_id}`)).size,
          unit: "Cycles",
          icon: "starts",
        },
        { motor: `Motor ${id.slice(1)}`, motorId: id, label: "Total Water Pumped", value: totalWaterPumped, unit: "Litres", icon: "water" },
      ]
    })

    const statusCards = motorIds.map((id) => {
      const rows = entriesByMotor.get(id) ?? []
      const selectedRangeMinutes = rows.reduce((sum, entry) => sum + entry.total_minutes, 0)
      const latest = rows[0]
      return {
        id,
        name: `Motor ${id.slice(1)}`,
        well: id === "M3" ? "Well 2 - South" : "Well 1 - North",
        status: "Idle",
        runHoursToday: runtimeHours(selectedRangeMinutes),
        lastStart: latest ? displayDate(latest.entry_date) : "--",
      }
    })

    const entriesByDate = new Map<string, RuntimeEntry[]>()
    for (const entry of sortedEntries) {
      const rows = entriesByDate.get(entry.entry_date) ?? []
      rows.push(entry)
      entriesByDate.set(entry.entry_date, rows)
    }

    const dateKeys = selectedDateKeys(startDate ?? "", endDate ?? "")
    const chartData = dateKeys.map((date) => {
      const point: Record<string, string | number | null> = { date: displayDate(date) }
      const dayEntries = entriesByDate.get(date) ?? []
      for (const id of motorIds) {
        const motorNo = Number(id.slice(1))
        const motorEntries = dayEntries.filter((entry) => entry.motor_no === motorNo)
        const totalMinutes = motorEntries
          .reduce((sum, entry) => sum + entry.total_minutes, 0)
        const confirmedNoRun = noRunRecords.some((record) => record.operation_date === date && record.motor_id === `motor-${motorNo}`)
        point[id] = motorEntries.length > 0 ? runtimeHours(totalMinutes) : confirmedNoRun ? 0 : null
      }
      return point
    })

    const irrigationTrend = dateKeys.map((date) => {
      const dayEntries = entriesByDate.get(date) ?? []
      const allMotorsConfirmedNoRun = motorIds.every((id) => noRunRecords.some(
        (record) => record.operation_date === date && record.motor_id === `motor-${id.slice(1)}`,
      ))
      const totalMinutes = dayEntries.reduce((sum, entry) => sum + entry.total_minutes, 0)
      return {
        date: displayDate(date),
        totalRuntimeHours: dayEntries.length > 0 ? runtimeHours(totalMinutes) : allMotorsConfirmedNoRun ? 0 : null,
        totalWaterLitres: dayEntries.length > 0
          ? dayEntries.reduce(
            (sum, entry) => sum + pumpedLitresForRuntimeMinutes(entry.total_minutes, entry.plot),
            0,
          )
          : allMotorsConfirmedNoRun ? 0 : null,
      }
    })

    const valveGroups = [
      {
        motors: "Recorded Motor Runtime Entries",
        valves: sortedEntries.map((entry) => ({
          date: displayDate(entry.entry_date),
          motorNo: `Motor ${entry.motor_no}`,
          valve: `Valve${entry.valve_no}`,
          area: plotLabels[entry.plot] ?? entry.plot,
          runtime: runtimeDisplay(entry.hours, entry.minutes),
          remarks: entry.remarks ?? "",
        })),
      },
    ]

    return NextResponse.json({
      summary: {
        total_entries: sortedEntries.length,
        confirmed_no_run_count: noRunRecords.length,
        first_entry_date: sortedEntries.at(-1)?.entry_date ?? null,
        latest_entry_date: sortedEntries[0]?.entry_date ?? null,
        selected_start_date: startDate,
        selected_end_date: endDate,
      },
      recordsByMotor,
      summaryStats,
      statusCards,
      chartData,
      irrigationTrend,
      valveGroups,
      entries: sortedEntries,
      noRunRecords,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Motor Runtime data" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
