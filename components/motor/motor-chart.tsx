"use client"

import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { motorSeriesConfig, type MotorChartPoint } from "@/lib/motor-data"

export function MotorChart({ data }: { data: MotorChartPoint[] }) {
  if (data.length === 0) {
    return <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">No runtime trend data for the selected period.</div>
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis width={44} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} label={{ value: "Run Hours", angle: -90, position: "insideLeft", style: { fill: "var(--muted-foreground)", fontSize: 11, textAnchor: "middle" } }} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--card-foreground)", fontSize: 12 }} />
          <Legend verticalAlign="top" height={32} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          {motorSeriesConfig.map((series) => <Line key={series.key} type="monotone" dataKey={series.key} name={series.label} stroke={series.color} strokeWidth={2} dot={{ r: 3, fill: series.color }} activeDot={{ r: 5 }} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
