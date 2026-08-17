"use client"

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Panel } from "@/components/farm/panel"
import { formatNumberIN, type TrendPoint, type Zone } from "@/lib/irrigation-data"

interface Props {
  zones: Zone[]
  trend: TrendPoint[]
  isLoading?: boolean
  errorMessage?: string | null
}

function fmt(value: unknown, name: unknown): [string, string] {
  const n = typeof value === "number" ? value : Number(value ?? 0)
  const label = String(name)
  if (label.toLowerCase().includes("runtime")) return [`${n.toLocaleString("en-IN")} h`, label]
  if (label.toLowerCase().includes("tree")) return [`${formatNumberIN(n)} L/tree`, label]
  return [`${formatNumberIN(n)} L`, label]
}

function fmtPerTree(value: unknown, name: unknown): [string, string] {
  const n = typeof value === "number" ? value : Number(value ?? 0)
  return [`${formatNumberIN(n)} L/tree`, String(name)]
}

const perTreeSeries = [
  { key: "P1W", name: "Plot 1 West", color: "#16a34a" },
  { key: "P1E", name: "Plot 1 East", color: "#2563eb" },
  { key: "P2W", name: "Plot 2 West", color: "#dc2626" },
  { key: "P2E", name: "Plot 2 East", color: "#f59e0b" },
  { key: "JF", name: "Jackfruit", color: "#7c3aed" },
  { key: "NM", name: "Nutmeg", color: "#0891b2" },
] as const

function PerTreeLegend() {
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-foreground">
      {perTreeSeries.map((series) => (
        <li key={series.key} className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 border-t-2" style={{ borderColor: series.color }} aria-hidden="true" />
          <span>{series.name}</span>
        </li>
      ))}
    </ul>
  )
}

function ChartState({ title, label }: { title: string; label: string }) {
  return (
    <Panel title={title}>
      <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">{label}</div>
    </Panel>
  )
}

function ChartStates({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartState title="Daily Irrigation Trend" label={label} />
      <ChartState title="Water Supplied per Tree" label={label} />
    </div>
  )
}

export function IrrigationChartsHybrid({ zones, trend, isLoading = false, errorMessage = null }: Props) {
  if (isLoading) {
    return <ChartStates label="Loading live chart data..." />
  }
  if (errorMessage) return <ChartStates label={errorMessage} />

  const hasAnyData = zones.some((zone) => zone.totalRuntimeMinutes > 0) || trend.length > 0
  if (!hasAnyData) return <ChartStates label="No live irrigation records for the selected period." />

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Daily Irrigation Trend">
        <ResponsiveContainer width="100%" height={310}>
          <LineChart data={trend} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="displayDate" />
            <YAxis yAxisId="water" tickFormatter={(value: number) => formatNumberIN(value)} label={{ value: "Water pumped (L)", angle: -90, position: "insideLeft" }} width={90} />
            <YAxis yAxisId="runtime" orientation="right" label={{ value: "Runtime (hours)", angle: 90, position: "insideRight" }} />
            <Tooltip formatter={(value, name) => fmt(value, name)} labelFormatter={(label) => `Date: ${label}`} />
            <Legend />
            <Line yAxisId="water" type="monotone" dataKey="totalWaterLitres" stroke="#2563eb" name="Water Pumped" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line yAxisId="runtime" type="monotone" dataKey="totalRuntimeHours" stroke="#16a34a" name="Runtime (hours)" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Water Supplied per Tree">
        <ResponsiveContainer width="100%" height={310}>
          <LineChart data={trend} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="displayDate" />
            <YAxis tickFormatter={(value: number) => formatNumberIN(value)} label={{ value: "Total water per tree (L)", angle: -90, position: "insideLeft" }} width={80} />
            <Tooltip formatter={(value, name) => fmtPerTree(value, name)} labelFormatter={(label) => `Date: ${label}`} />
            <Legend content={<PerTreeLegend />} />
            {perTreeSeries.map((series) => (
              <Line key={series.key} type="monotone" dataKey={series.key} stroke={series.color} name={series.name} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-3 text-xs text-muted-foreground">Rates: Plot 1 and Plot 2 zones 100 L/tree/hour; Jackfruit and Nutmeg 60 L/tree/hour.</p>
      </Panel>
    </div>
  )
}
