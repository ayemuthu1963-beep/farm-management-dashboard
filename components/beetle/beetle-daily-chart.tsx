"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { dailyCounts } from "@/lib/beetle-data"

// Oldest -> newest (left to right). Counts stay separate; no total is shown.
const data = [...dailyCounts].reverse()

export function BeetleDailyChart() {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={56}
          />
          <YAxis
            width={40}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
              color: "var(--card-foreground)",
              fontSize: 12,
            }}
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="rhinoceros" name="Rhinoceros" fill="var(--foreground)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="redPalmWeevil" name="Red Palm Weevil" fill="var(--destructive)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
