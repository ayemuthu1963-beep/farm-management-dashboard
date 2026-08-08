"use client"

import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from "recharts"

export interface BeetleDailyCountRow {
  date: string
  sourceDate?: string
  rhinoceros: number
  redPalmWeevil: number
  plot1Rhinoceros: number
  plot1RedPalmWeevil: number
  plot2Rhinoceros: number
  plot2RedPalmWeevil: number
}

interface BeetleDailyChartProps {
  counts: BeetleDailyCountRow[]
  waterChangeDates: string[]
}

function chartDate(value: unknown): string {
  const date = typeof value === "string" ? value : ""
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(parsed)
}

export function BeetleDailyChart({ counts, waterChangeDates }: BeetleDailyChartProps) {
  const countDates = new Set(counts.map((count) => count.sourceDate).filter((date): date is string => Boolean(date)))
  // Include a no-inspection water-change date in the category axis so its marker is never omitted.
  const data = [
    ...counts,
    ...waterChangeDates
      .filter((date) => !countDates.has(date))
      .map((date) => ({ date: chartDate(date), sourceDate: date })),
  ].sort((left, right) => (left.sourceDate ?? "").localeCompare(right.sourceDate ?? ""))

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="sourceDate" tickFormatter={chartDate} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} angle={-30} textAnchor="end" height={56} />
          <YAxis width={40} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip labelFormatter={chartDate} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--card-foreground)", fontSize: 12 }} cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {waterChangeDates.map((date) => (
            <ReferenceLine key={`water-change-${date}`} x={date} stroke="var(--chart-2)" strokeWidth={2} label={{ value: "Water changed", position: "top", fill: "var(--chart-2)", fontSize: 10 }} />
          ))}
          <Line type="monotone" dataKey="plot1RedPalmWeevil" name="Plot 1 — Red Palm Weevil" stroke="var(--destructive)" strokeWidth={2} connectNulls dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="plot1Rhinoceros" name="Plot 1 — Rhinoceros Beetle" stroke="var(--foreground)" strokeWidth={2} connectNulls dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="plot2RedPalmWeevil" name="Plot 2 — Red Palm Weevil" stroke="var(--destructive)" strokeWidth={2} strokeDasharray="5 3" connectNulls dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="plot2Rhinoceros" name="Plot 2 — Rhinoceros Beetle" stroke="var(--foreground)" strokeWidth={2} strokeDasharray="5 3" connectNulls dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
