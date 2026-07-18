"use client"

import { Panel } from "@/components/farm/panel"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { IRRIGATION_RECORDS, ZONE_CONFIG, formatWaterLitres, type ZoneId } from "@/lib/irrigation-mock-data"

interface IrrigationChartsProps {
  dateStr: string
}

export function IrrigationChartsHybrid({ dateStr }: IrrigationChartsProps) {
  // Get records for the date
  const records = IRRIGATION_RECORDS.filter((r) => r.date === dateStr)

  // Data for Runtime by Zone
  const zoneIds = Object.keys(ZONE_CONFIG) as ZoneId[]
  const runtimeByZone = zoneIds.map((zoneId) => {
    const zone = ZONE_CONFIG[zoneId]
    const totalMinutes = records.filter((r) => r.zoneId === zoneId).reduce((sum, r) => sum + r.runtimeMinutes, 0)
    const totalHours = totalMinutes / 60

    return {
      zone: zone.abbr,
      runtime: totalHours,
      name: zone.name,
    }
  })

  // Data for Water by Zone
  const waterByZone = zoneIds.map((zoneId) => {
    const zone = ZONE_CONFIG[zoneId]
    const totalWater = records.filter((r) => r.zoneId === zoneId).reduce((sum, r) => sum + r.totalWaterLitres, 0)

    return {
      zone: zone.abbr,
      water: totalWater / 1000, // Convert to thousands for readability
      name: zone.name,
    }
  })

  // Data for Water per Tree comparison
  const waterPerTreeData = records.map((r) => ({
    zone: ZONE_CONFIG[r.zoneId].abbr,
    waterPerTree: r.waterPerTreeLitres,
    name: ZONE_CONFIG[r.zoneId].name,
    time: r.startTime,
  }))

  // Colors for zones
  const zoneColors: Record<ZoneId, string> = {
    P1E: "#10b981",
    P1W: "#059669",
    P2E: "#34d399",
    P2W: "#6ee7b7",
    JF: "#fbbf24",
    NM: "#d97706",
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Runtime by Zone */}
      <Panel title="Runtime by Zone">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={runtimeByZone} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="zone" stroke="#6b7280" />
            <YAxis stroke="#6b7280" label={{ value: "Hours", angle: -90, position: "insideLeft" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }}
              formatter={(value: any) => [(value as number).toFixed(2), "Hours"]}
              labelFormatter={(label: any) => `Zone: ${label}`}
            />
            <Bar dataKey="runtime" fill="#3b82f6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {/* Water Pumped by Zone */}
      <Panel title="Water Pumped by Zone (1000s of Litres)">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={waterByZone} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="zone" stroke="#6b7280" />
            <YAxis stroke="#6b7280" label={{ value: "1000 L", angle: -90, position: "insideLeft" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }}
              formatter={(value: any) => [formatWaterLitres((value as number) * 1000), "Water"]}
              labelFormatter={(label: any) => `Zone: ${label}`}
            />
            <Bar dataKey="water" fill="#06b6d4" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {/* Water per Tree by Record */}
      <Panel title="Water per Tree by Record">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={waterPerTreeData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="time"
              stroke="#6b7280"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis stroke="#6b7280" label={{ value: "Litres per Tree", angle: -90, position: "insideLeft" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }}
              formatter={(value: any) => [formatWaterLitres(value as number), "Water/Tree"]}
              labelFormatter={(label: any) => `Time: ${label}`}
            />
            <Legend />
            {zoneIds.map((zoneId) => (
              <Line
                key={zoneId}
                type="monotone"
                dataKey="waterPerTree"
                stroke={zoneColors[zoneId]}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      {/* Zone Distribution Pie */}
      <Panel title="Irrigation Activity Distribution">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <Pie
              data={runtimeByZone.filter((z) => z.runtime > 0)}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => `${entry.zone} (${(entry.runtime as number).toFixed(1)}h)`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="runtime"
            >
              {runtimeByZone.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={zoneColors[zoneIds[index]]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: any) => [(value as number).toFixed(2), "Hours"]} />
          </PieChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}
