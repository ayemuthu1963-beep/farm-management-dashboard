"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Droplets, TrendingUp } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { irrigationZoneVisuals } from "@/components/irrigation/irrigation-zone-visuals"
import { formatNumberIN, type TrendPoint, type ZoneId } from "@/lib/irrigation-data"

interface Props {
  trend: TrendPoint[]
  isLoading?: boolean
  errorMessage?: string | null
}

const zoneSeries: Array<{
  id: ZoneId
  label: string
  perTreeKey: "P1EPerTree" | "P1WPerTree" | "P2EPerTree" | "P2WPerTree" | "JFPerTree" | "NMPerTree"
}> = [
  { id: "P1E", label: "Plot 1 East", perTreeKey: "P1EPerTree" },
  { id: "P1W", label: "Plot 1 West", perTreeKey: "P1WPerTree" },
  { id: "P2E", label: "Plot 2 East", perTreeKey: "P2EPerTree" },
  { id: "P2W", label: "Plot 2 West", perTreeKey: "P2WPerTree" },
  { id: "JF", label: "Jackfruit", perTreeKey: "JFPerTree" },
  { id: "NM", label: "Nutmeg", perTreeKey: "NMPerTree" },
]

function ChartState({ label, wide = false, title = "Irrigation chart" }: { label: string; wide?: boolean; title?: string }) {
  return (
    <Panel title={title} className={wide ? "lg:col-span-2" : undefined}>
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground">
        {label}
      </div>
    </Panel>
  )
}

function litresTooltip(value: unknown, name: unknown): [string, string] {
  const numericValue = typeof value === "number" ? value : Number(value ?? 0)
  return [`${formatNumberIN(numericValue)} L`, String(name)]
}

const axisTick = { fontSize: 11 }

export function IrrigationOverviewCharts({
  trend,
  isLoading = false,
  errorMessage = null,
}: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartState label="Loading total water pumped..." />
        <ChartState label="Loading daily irrigation trend..." />
      </div>
    )
  }

  if (errorMessage) {
    return <ChartState label={`${errorMessage}. Use Refresh to retry.`} wide />
  }

  if (trend.length === 0) {
    return <ChartState label="No live irrigation records for the selected period." wide />
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Total Water Pumped — Date Wise" icon={TrendingUp}>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="displayDate" tick={axisTick} />
              <YAxis
                width={84}
                tick={axisTick}
                tickFormatter={(value: number) => formatNumberIN(value)}
                label={{ value: "Total litres pumped", angle: -90, position: "insideLeft" }}
              />
              <Tooltip formatter={(value, name) => litresTooltip(value, name)} labelFormatter={(label) => `Date: ${label}`} />
              <Line
                type="monotone"
                dataKey="totalWaterLitres"
                name="Total Water Pumped"
                stroke="#16a34a"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Daily Irrigation Trend" icon={Droplets}>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="displayDate" tick={axisTick} />
              <YAxis
                width={84}
                tick={axisTick}
                tickFormatter={(value: number) => formatNumberIN(value)}
                label={{ value: "Water pumped (L)", angle: -90, position: "insideLeft" }}
              />
              <Tooltip formatter={(value, name) => litresTooltip(value, name)} labelFormatter={(label) => `Date: ${label}`} />
              <Legend />
              {zoneSeries.map((series) => (
                <Bar
                  key={series.id}
                  dataKey={series.id}
                  name={series.label}
                  fill={irrigationZoneVisuals[series.id].chart}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  )
}

export function WaterPerTreeTrendChart({
  trend,
  isLoading = false,
  errorMessage = null,
}: Props) {
  if (isLoading) return <ChartState title="Water Per Tree Trend" label="Loading water per tree trend..." />
  if (errorMessage) return <ChartState title="Water Per Tree Trend" label={`${errorMessage}. Use Refresh to retry.`} />
  if (trend.length === 0) return <ChartState title="Water Per Tree Trend" label="No live irrigation records for the selected period." />

  return (
    <Panel title="Water Per Tree Trend" icon={TrendingUp}>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="displayDate" tick={axisTick} />
            <YAxis
              width={76}
              tick={axisTick}
              tickFormatter={(value: number) => formatNumberIN(value)}
              label={{ value: "Litres per tree", angle: -90, position: "insideLeft" }}
            />
            <Tooltip formatter={(value, name) => litresTooltip(value, name)} labelFormatter={(label) => `Date: ${label}`} />
            <Legend />
            {zoneSeries.map((series) => (
              <Line
                key={series.id}
                type="monotone"
                dataKey={series.perTreeKey}
                name={series.label}
                stroke={irrigationZoneVisuals[series.id].chart}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Live crop rates: Coconut 100 L/tree/hour, Nutmeg 80 L/tree/hour, Jackfruit 60 L/tree/hour.
      </p>
    </Panel>
  )
}
