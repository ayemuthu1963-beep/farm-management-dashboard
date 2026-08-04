import { FALLBACK_MOTORS } from "./motor-screenshot-analysis-config"
import type { DateSummary, MotorId, RunRecord } from "./motor-screenshot-analysis-types"

export function groupByDate(records: RunRecord[]): DateSummary[] {
  const byDate = new Map<string, RunRecord[]>()
  for (const record of records) byDate.set(record.date, [...(byDate.get(record.date) ?? []), record])
  return Array.from(byDate.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, dateRecords]) => {
      const perMotorSeconds = Object.fromEntries(FALLBACK_MOTORS.map((motor) => [motor.id, 0])) as Record<MotorId, number>
      for (const record of dateRecords) {
        if (record.status === "complete") perMotorSeconds[record.motorId] += record.runtimeSeconds
      }
      const combinedSeconds = Object.values(perMotorSeconds).reduce((sum, value) => sum + value, 0)
      return {
        date,
        perMotorSeconds,
        perMotorMinutes: Object.fromEntries(
          Object.entries(perMotorSeconds).map(([id, seconds]) => [id, Math.round(seconds / 60)]),
        ) as Record<MotorId, number>,
        combinedSeconds,
        combinedMinutes: Math.round(combinedSeconds / 60),
        completeRuns: dateRecords.filter((record) => record.status === "complete").length,
        unmatched: dateRecords.filter((record) => record.status !== "complete").length,
        records: dateRecords.toSorted((left, right) =>
          left.motorId === right.motorId ? left.run - right.run : left.motorId.localeCompare(right.motorId),
        ),
      }
    })
}
