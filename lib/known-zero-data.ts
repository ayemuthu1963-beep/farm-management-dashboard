import type { TrendPoint, ZoneId } from "./irrigation-data"
import type { MotorId, PublicMotorNoRunRecord } from "./motor-data"

export const ZONE_SCHEDULE_MOTOR_IDS: Readonly<Record<ZoneId, MotorId>> = {
  P1W: "M1",
  P1E: "M1",
  P2W: "M2",
  P2E: "M3",
  JF: "M3",
  NM: "M1",
}

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

export function knownZeroReasonsForZoneDate(
  records: readonly PublicMotorNoRunRecord[],
  date: string,
): Partial<Record<ZoneId, string>> {
  return Object.fromEntries(
    Object.entries(ZONE_SCHEDULE_MOTOR_IDS).flatMap(([zoneId, motorId]) => {
      const reason = noRunReasonForAllMotors(records, date, [motorId])
      return reason ? [[zoneId, reason]] : []
    }),
  ) as Partial<Record<ZoneId, string>>
}

export function formatKnownZeroActual(reason: string): string {
  return `0 L/tree — Not run: ${reason}`
}

export function applyScheduledKnownZerosToTrend(
  trend: readonly TrendPoint[],
  isScheduled: (zoneId: ZoneId, date: string) => boolean,
): TrendPoint[] {
  return trend.map((sourcePoint) => {
    const point: TrendPoint = { ...sourcePoint }
    let hasScheduledKnownZero = false
    for (const [zoneId, reason] of Object.entries(sourcePoint.knownZeroReasons ?? {}) as Array<[ZoneId, string]>) {
      if (!reason || point[zoneId] !== null || !isScheduled(zoneId, point.date)) continue
      point[zoneId] = 0
      hasScheduledKnownZero = true
    }
    if (hasScheduledKnownZero) {
      if (point.totalWaterLitres === null) point.totalWaterLitres = 0
      if (point.totalRuntimeHours === null) point.totalRuntimeHours = 0
    }
    return point
  })
}
