"use client"

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Panel } from "@/components/farm/panel"
import { formatNumberIN } from "@/lib/irrigation-data"
import type { MotorIrrigationTrendPoint } from "@/lib/motor-data"

interface Props {
  data: MotorIrrigationTrendPoint[]
}

function fmt(value: unknown, name: unknown): [string, string] {
  const n = typeof value === "number" ? value : Number(value ?? 0)
  const label = String(name)
  if (label.toLowerCase().includes("runtime")) return [`${n.toLocaleString("en-IN")} h`, label]
  return [`${formatNumberIN(n)} L`, label]
}

export function MotorIrrigationTrend({ data }: Props) {
  return (
    <Panel title="Daily Irrigation Trend">
      {data.length === 0 ? (
        <div className="flex h-[310px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">No daily irrigation data for the selected period.</div>
      ) : (
        <ResponsiveContainer width="100%" height={310}>
          <LineChart data={data} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="water" tickFormatter={(value: number) => formatNumberIN(value)} label={{ value: "Water pumped (L)", angle: -90, position: "insideLeft" }} width={90} />
            <YAxis yAxisId="runtime" orientation="right" label={{ value: "Runtime (hours)", angle: 90, position: "insideRight" }} />
            <Tooltip formatter={(value, name) => fmt(value, name)} labelFormatter={(label) => `Date: ${label}`} />
            <Legend />
            <Line yAxisId="water" type="monotone" dataKey="totalWaterLitres" stroke="#2563eb" name="Water Pumped" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line yAxisId="runtime" type="monotone" dataKey="totalRuntimeHours" stroke="#16a34a" name="Runtime (hours)" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Panel>
  )
}
