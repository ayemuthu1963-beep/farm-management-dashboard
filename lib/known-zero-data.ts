import type { TrendPoint, Zone, ZoneId } from "./irrigation-data"
import type { ScheduledZoneAssignment } from "./irrigation-schedule-comparison"
import type { MotorId, PublicMotorNoRunRecord } from "./motor-data"

export const WELL_MOTOR_IDS = {
  north: ["M1", "M2"],
  south: ["M3"],
} as const satisfies Readonly<Record<"north" | "south", readonly MotorId[]>>

export function noRunReasonForAllMotors(
  records: readonly PublicMotorNoRunRecord[],
  date: string,
  motorIds: readonly MotorId[],
): string | null {
  const reasons = motorIds.map((motorId) =>
    records.find((record) => record.date === date && record.motorId === motorId)?.reason,
  )
  if (reasons.some((reason) => !reason)) return null
  return Array.from(new Set(reasons as string[])).join(" / ")
}

function knownZeroReasonForScheduleAssignment(
  records: readonly PublicMotorNoRunRecord[],
  date: string,
  assignment: ScheduledZoneAssignment,
): string | null {
  if (assignment.kind !== "scheduled" || !assignment.motorId) return null
  return noRunReasonForAllMotors(records, date, [assignment.motorId])
}

export function formatKnownZeroActual(reason: string): string {
  return `0 L/tree — Not run: ${formatKnownZeroDisplayReason(reason)}`
}

export function formatKnownZeroDisplayReason(reason: string): string {
  const displayTokens: string[] = []
  const seen = new Set<string>()
  for (const sourceToken of reason.split(" / ")) {
    const trimmed = sourceToken.trim()
    if (!trimmed) continue
    const normalized = trimmed.toLowerCase()
    const display = normalized === "rains" || normalized === "heavy rains" || normalized === "heavy rain"
      ? "Heavy rain"
      : trimmed
    if (seen.has(display)) continue
    seen.add(display)
    displayTokens.push(display)
  }
  return displayTokens.join(" / ")
}

export function applyScheduledKnownZerosToTrend(
  trend: readonly TrendPoint[],
  records: readonly PublicMotorNoRunRecord[],
  scheduleForZoneDate: (zoneId: ZoneId, date: string) => ScheduledZoneAssignment,
  zoneIds: readonly ZoneId[],
): TrendPoint[] {
  return trend.map((sourcePoint) => {
    const point: TrendPoint = { ...sourcePoint }
    const hasFullyMeasuredAggregate = zoneIds.length > 0
      && sourcePoint.totalWaterLitres !== null
      && sourcePoint.totalRuntimeHours !== null
      && zoneIds.every((zoneId) => sourcePoint[zoneId] !== null)
    if (hasFullyMeasuredAggregate) return point

    const assignments = new Map(zoneIds.map((zoneId) => [
      zoneId,
      scheduleForZoneDate(zoneId, point.date),
    ]))
    const scheduledZoneIds = zoneIds.filter((zoneId) => assignments.get(zoneId)?.kind === "scheduled")
    const scheduleIsUnavailable = Array.from(assignments.values()).some(
      (assignment) => assignment.kind === "loading" || assignment.kind === "unavailable",
    )
    const appliedKnownZeroZoneIds = new Set<ZoneId>()
    for (const zoneId of scheduledZoneIds) {
      if (point[zoneId] !== null) continue
      const assignment = assignments.get(zoneId)
      if (!assignment) continue
      const reason = knownZeroReasonForScheduleAssignment(records, point.date, assignment)
      if (!reason) continue
      point[zoneId] = 0
      appliedKnownZeroZoneIds.add(zoneId)
    }
    if (scheduleIsUnavailable) {
      point.totalWaterLitres = null
      point.totalRuntimeHours = null
    } else if (scheduledZoneIds.length > 0) {
      const aggregateIsComplete = scheduledZoneIds.every((zoneId) => point[zoneId] !== null)
      if (!aggregateIsComplete) {
        point.totalWaterLitres = null
        point.totalRuntimeHours = null
      } else if (appliedKnownZeroZoneIds.size === scheduledZoneIds.length) {
        if (point.totalWaterLitres === null) point.totalWaterLitres = 0
        if (point.totalRuntimeHours === null) point.totalRuntimeHours = 0
      }
    }
    return point
  })
}

export function applyScheduledKnownZerosToZones(
  zones: readonly Zone[],
  records: readonly PublicMotorNoRunRecord[],
  scheduleForZoneDate: (zoneId: ZoneId, date: string) => ScheduledZoneAssignment,
): Zone[] {
  return zones.map((zone) => ({
    ...zone,
    fiveDayHistory: zone.fiveDayHistory.map((sourceDay) => {
      const day = { ...sourceDay }
      delete day.knownZeroReason
      if (day.perTreeLitres !== null) return day
      const reason = knownZeroReasonForScheduleAssignment(
        records,
        day.date,
        scheduleForZoneDate(zone.id, day.date),
      )
      return reason ? { ...day, knownZeroReason: reason } : day
    }),
  }))
}
