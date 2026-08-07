"use client"

import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"

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
}

export function BeetleDailyChart({ counts }: BeetleDailyChartProps) {
  const data = [...counts].reverse()

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} angle={-30} textAnchor="end" height={56} />
          <YAxis width={40} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--card-foreground)", fontSize: 12 }} cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="plot1RedPalmWeevil" name="Plot 1 — Red Palm Weevil" stroke="var(--destructive)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="plot1Rhinoceros" name="Plot 1 — Rhinoceros Beetle" stroke="var(--foreground)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="plot2RedPalmWeevil" name="Plot 2 — Red Palm Weevil" stroke="var(--chart-1)" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="plot2Rhinoceros" name="Plot 2 — Rhinoceros Beetle" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
