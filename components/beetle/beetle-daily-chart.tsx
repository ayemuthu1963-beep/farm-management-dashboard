"use client"

import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from "recharts"

import { BEETLE_LURE_SERIES, type BeetleLureDailyRow } from "@/lib/beetle-lure-comparison"

export type BeetleDailyCountRow = BeetleLureDailyRow

interface BeetleDailyChartProps {
  counts: BeetleDailyCountRow[]
  waterChangeDates: string[]
  pheromoneChangeDate: string | null
}

function chartDate(value: unknown): string {
  const date = typeof value === "string" ? value : ""
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(parsed)
}

export function BeetleDailyChart({ counts, waterChangeDates, pheromoneChangeDate }: BeetleDailyChartProps) {
  const countDates = new Set(counts.map((count) => count.sourceDate).filter((date): date is string => Boolean(date)))
  const eventDates = new Set([
    ...waterChangeDates,
    ...(pheromoneChangeDate ? [pheromoneChangeDate] : []),
  ])
  // Add event-only dates to the categorical axis, so neither marker disappears
  // when water or pheromone was changed on a day without an inspection.
  const data = [
    ...counts,
    ...[...eventDates]
      .filter((date) => !countDates.has(date))
      .map((date) => ({ date: chartDate(date), sourceDate: date })),
  ].sort((left, right) => (left.sourceDate ?? "").localeCompare(right.sourceDate ?? ""))

  return (
    <div className="h-[480px] w-full sm:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="sourceDate" tickFormatter={chartDate} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} angle={-30} textAnchor="end" height={56} padding={{ left: 48, right: 16 }} />
          <YAxis width={40} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip labelFormatter={chartDate} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--card-foreground)", fontSize: 12 }} cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} itemSorter={(item) => BEETLE_LURE_SERIES.findIndex((series) => series.key === item.dataKey)} />
          {BEETLE_LURE_SERIES.map((series) => (
            <Line key={series.key} type="linear" dataKey={series.key}
              name={`Plot ${series.plot} ${series.company} — ${series.species} (${series.plot === 1 ? "solid" : "dashed"})`}
              stroke={series.color} strokeWidth={2} strokeDasharray={series.plot === 2 ? "5 3" : undefined}
              connectNulls={false} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          ))}
          {pheromoneChangeDate ? (
            <ReferenceLine x={pheromoneChangeDate} stroke="#dc2626" strokeWidth={3} label={{ value: "Pheromone change / reset", position: "insideTopLeft", fill: "#b91c1c", fontSize: 12, fontWeight: 700 }} />
          ) : null}
          {waterChangeDates.map((date) => (
            <ReferenceLine key={`water-change-${date}`} x={date} stroke="#047857" strokeWidth={3} label={{ value: "Water changed", position: "insideBottomRight", fill: "#065f46", fontSize: 12, fontWeight: 700 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
