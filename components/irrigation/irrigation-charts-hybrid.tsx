"use client"

import { Panel } from "@/components/farm/panel"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { IRRIGATION_RECORDS, ZONE_CONFIG, formatWaterLitres, type ZoneId } from "@/lib/irrigation-mock-data"

interface IrrigationChartsProps {
  dateStr: string
}

export function IrrigationChartsHybrid({ dateStr }: IrrigationChartsProps) {
  // Get records for the date
  const records = IRRIGATION_RECORDS.filter((r) => r.date === dateStr)

  // Zone order: P1E, P1W, P2E, P2W, JF, NM
  const zoneOrder: ZoneId[] = ["P1E", "P1W", "P2E", "P2W", "JF", "NM"]
  
  // ========================================
  // CHART 1: Runtime and Water Pumped by Zone
  // ========================================
  const runtimeAndWaterData = zoneOrder.map((zoneId) => {
    const zone = ZONE_CONFIG[zoneId]
    const zoneRecords = records.filter((r) => r.zoneId === zoneId)
    const totalMinutes = zoneRecords.reduce((sum, r) => sum + r.runtimeMinutes, 0)
    const totalHours = totalMinutes / 60
    const totalWater = zoneRecords.reduce((sum, r) => sum + r.totalWaterLitres, 0)

    return {
      zone: zone.abbr,
      runtime: parseFloat(totalHours.toFixed(2)),
      water: totalWater, // in litres
      waterK: totalWater / 1000, // for dual-axis display
    }
  })

  // ========================================
  // CHART 2: Water Supplied per Tree
  // ========================================
  const waterPerTreeData = zoneOrder.map((zoneId) => {
    const zone = ZONE_CONFIG[zoneId]
    const zoneRecords = records.filter((r) => r.zoneId === zoneId)
    const avgWaterPerTree = zoneRecords.length > 0 
      ? zoneRecords.reduce((sum, r) => sum + r.waterPerTreeLitres, 0) / zoneRecords.length 
      : 0

    return {
      zone: zone.abbr,
      water: parseFloat(avgWaterPerTree.toFixed(1)),
      crop: zone.crop,
    }
  })

  // ========================================
  // CHART 3: Daily Irrigation Trend (last 10 days)
  // ========================================
  const allDates = [...new Set(IRRIGATION_RECORDS.map((r) => r.date))].sort()
  const last10Dates = allDates.slice(-10)

  const trendData = last10Dates.map((date) => {
    const dateRecords = IRRIGATION_RECORDS.filter((r) => r.date === date)
    const totalWater = dateRecords.reduce((sum, r) => sum + r.totalWaterLitres, 0)
    const totalMinutes = dateRecords.reduce((sum, r) => sum + r.runtimeMinutes, 0)
    const totalHours = totalMinutes / 60

    return {
      date: new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      water: totalWater,
      runtime: parseFloat(totalHours.toFixed(1)),
    }
  })

  // Zone colors
  const zoneColors: Record<ZoneId, string> = {
    P1E: "#3b82f6", // blue
    P1W: "#10b981", // green
    P2E: "#f59e0b", // amber
    P2W: "#ef4444", // red
    JF: "#8b5cf6", // purple
    NM: "#ec4899", // pink
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Chart 1: Runtime and Water Pumped by Zone */}
      <Panel title="Runtime & Water Pumped by Zone">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={runtimeAndWaterData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="zone" />
            <YAxis yAxisId="left" label={{ value: "Runtime (hours)", angle: -90, position: "insideLeft" }} />
            <YAxis yAxisId="right" orientation="right" label={{ value: "Water (thousands litres)", angle: 90, position: "insideRight" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }}
              formatter={(value: any) => {
                return [(value as number).toFixed(2)]
              }}
              labelFormatter={(label: any) => `Zone: ${label}`}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="runtime" fill="#3b82f6" name="Runtime (hours)" />
            <Bar yAxisId="right" dataKey="waterK" fill="#10b981" name="Water (K litres)" />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {/* Chart 2: Water Supplied per Tree */}
      <Panel title="Water Supplied per Tree by Crop">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={waterPerTreeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="zone" />
            <YAxis label={{ value: "Litres per Tree", angle: -90, position: "insideLeft" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }}
              formatter={(value: any) => [(value as number).toFixed(1), "L/Tree"]}
              labelFormatter={(label: any) => `Zone: ${label}`}
            />
            <Legend />
            <Bar dataKey="water" fill="#f59e0b" name="Water per Tree (litres)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 text-xs text-muted-foreground">
          <p className="mb-1">Crop rates: Coconut 100 L/tree, Jackfruit 60 L/tree, Nutmeg 80 L/tree</p>
        </div>
      </Panel>

      {/* Chart 3: Daily Irrigation Trend */}
      <Panel title="Daily Irrigation Trend (Last 10 Days)" className="lg:col-span-2">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" label={{ value: "Water Pumped (thousands litres)", angle: -90, position: "insideLeft" }} />
            <YAxis yAxisId="right" orientation="right" label={{ value: "Runtime (hours)", angle: 90, position: "insideRight" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }}
              formatter={(value: any) => {
                return [(value as number).toFixed(1)]
              }}
              labelFormatter={(label: any) => `Date: ${label}`}
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="water" stroke="#3b82f6" name="Total Water (litres)" strokeWidth={2} dot={{ r: 4 }} />
            <Line yAxisId="right" type="monotone" dataKey="runtime" stroke="#10b981" name="Total Runtime (hours)" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}
