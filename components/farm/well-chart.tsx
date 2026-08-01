"use client"

import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import type { ChartPoint } from "@/lib/well-data"
import {
  formatLitresAxisTick,
  formatNumberIN,
  formatSignedLitres,
  includeZeroInWellChartDomain,
  seriesConfig,
} from "@/lib/well-data"

interface WellChartProps {
  data: ChartPoint[]
}

export function WellChart({ data }: WellChartProps) {
  return (
    <div className="h-72 min-h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 12 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            width={96}
            domain={includeZeroInWellChartDomain}
            tickFormatter={formatLitresAxisTick}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickMargin={8}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value, name) => [
              name === "Morning Difference"
                ? formatSignedLitres(Number(value), true)
                : `${formatNumberIN(Math.round(Number(value)))} L`,
              name,
            ]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
              color: "var(--card-foreground)",
              fontSize: 12,
            }}
          />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          <Legend
            verticalAlign="top"
            height={32}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12 }}
          />
          {seriesConfig.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2}
              dot={{ r: 3, fill: series.color }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
