import { BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { TrendPoint, Zone } from "@/lib/irrigation-data"
import { Panel } from "@/components/farm/panel"

interface IrrigationChartsProps {
  zones: Zone[]
  waterPerTreeTrend: TrendPoint[]
}

export function IrrigationCharts({ zones, waterPerTreeTrend }: IrrigationChartsProps) {
  const zoneWaterData = zones.map((z) => ({
    name: z.name,
    water: z.totalWaterSupplied,
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Water Supplied by Zone - Bar Chart */}
      <Panel title="Water Supplied by Zone">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={zoneWaterData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={80}
              />
              <YAxis
                width={50}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                label={{ value: "Litres", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  color: "var(--card-foreground)",
                  fontSize: 12,
                }}
                formatter={(value: any) => [value.toLocaleString("en-IN"), "Water Supplied"]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="water" name="Water (L)" fill="var(--chart-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Water per Tree Trend - Line Chart */}
      <Panel title="Water per Tree Trend">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={waterPerTreeTrend} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                width={50}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                label={{ value: "L/tree", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  color: "var(--card-foreground)",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="P1E"
                name="Plot 1 East"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="P1W"
                name="Plot 1 West"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="P2E"
                name="Plot 2 East"
                stroke="var(--chart-3)"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="P2W"
                name="Plot 2 West"
                stroke="var(--chart-4)"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="JF"
                name="Jackfruit"
                stroke="var(--chart-5)"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  )
}
