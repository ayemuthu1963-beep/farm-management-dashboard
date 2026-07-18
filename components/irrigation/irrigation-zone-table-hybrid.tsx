"use client"

import { useState } from "react"
import { Panel } from "@/components/farm/panel"
import { IRRIGATION_RECORDS, ZONE_CONFIG, formatWaterLitres, formatRuntimeMinutes, type ZoneId } from "@/lib/irrigation-mock-data"
import { ChevronDown, ChevronUp } from "lucide-react"

interface IrrigationZoneTableProps {
  dateStr: string
}

export function IrrigationZoneTableHybrid({ dateStr }: IrrigationZoneTableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "startTime", direction: "asc" })
  const [zoneFilter, setZoneFilter] = useState<ZoneId | "all">("all")

  // Filter records
  let filteredRecords = IRRIGATION_RECORDS.filter((r) => r.date === dateStr)
  if (zoneFilter !== "all") {
    filteredRecords = filteredRecords.filter((r) => r.zoneId === zoneFilter)
  }

  // Sort records
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    let aVal: any = a[sortConfig.key as keyof typeof a]
    let bVal: any = b[sortConfig.key as keyof typeof b]

    if (sortConfig.direction === "asc") {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    }
  })

  const handleSort = (key: string) => {
    if (sortConfig.key === key) {
      setSortConfig({ key, direction: sortConfig.direction === "asc" ? "desc" : "asc" })
    } else {
      setSortConfig({ key, direction: "asc" })
    }
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortConfig.key !== field) return <div className="w-4 h-4" />
    return sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
  }

  return (
    <Panel title="Detailed Irrigation Records">
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">Zone:</label>
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value as ZoneId | "all")}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Zones</option>
          {Object.entries(ZONE_CONFIG).map(([id, config]) => (
            <option key={id} value={id}>
              {config.name} ({config.abbr})
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">{sortedRecords.length} records</span>
      </div>

      {/* Table */}
      {sortedRecords.length === 0 ? (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-600">No irrigation records for the selected date and filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2 text-left font-semibold text-foreground">
                  <button onClick={() => handleSort("date")} className="flex items-center gap-1 hover:text-primary">
                    Date
                    <SortIcon field="date" />
                  </button>
                </th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">
                  <button onClick={() => handleSort("startTime")} className="flex items-center gap-1 hover:text-primary">
                    Time
                    <SortIcon field="startTime" />
                  </button>
                </th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">
                  <button onClick={() => handleSort("zoneId")} className="flex items-center gap-1 hover:text-primary">
                    Zone
                    <SortIcon field="zoneId" />
                  </button>
                </th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Motor</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Valve</th>
                <th className="px-4 py-2 text-right font-semibold text-foreground">
                  <button onClick={() => handleSort("runtimeMinutes")} className="flex items-center gap-1 ml-auto hover:text-primary">
                    Runtime
                    <SortIcon field="runtimeMinutes" />
                  </button>
                </th>
                <th className="px-4 py-2 text-right font-semibold text-foreground">
                  <button onClick={() => handleSort("totalWaterLitres")} className="flex items-center gap-1 ml-auto hover:text-primary">
                    Water
                    <SortIcon field="totalWaterLitres" />
                  </button>
                </th>
                <th className="px-4 py-2 text-right font-semibold text-foreground">
                  <button onClick={() => handleSort("waterPerTreeLitres")} className="flex items-center gap-1 ml-auto hover:text-primary">
                    Per Tree
                    <SortIcon field="waterPerTreeLitres" />
                  </button>
                </th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Crop</th>
                <th className="px-4 py-2 text-right font-semibold text-foreground">Trees</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((record, idx) => (
                <tr key={record.id} className={idx % 2 === 0 ? "bg-transparent" : "bg-muted/20 hover:bg-muted/40"}>
                  <td className="px-4 py-2 text-foreground">{record.date}</td>
                  <td className="px-4 py-2 text-foreground">{record.startTime}</td>
                  <td className="px-4 py-2 font-medium text-foreground">
                    {ZONE_CONFIG[record.zoneId].abbr}
                  </td>
                  <td className="px-4 py-2 text-foreground">{record.motor}</td>
                  <td className="px-4 py-2 text-foreground">{record.valve}</td>
                  <td className="px-4 py-2 text-right text-foreground">{formatRuntimeMinutes(record.runtimeMinutes)}</td>
                  <td className="px-4 py-2 text-right text-foreground">{formatWaterLitres(record.totalWaterLitres)}</td>
                  <td className="px-4 py-2 text-right text-foreground">{formatWaterLitres(record.waterPerTreeLitres)}</td>
                  <td className="px-4 py-2 capitalize text-foreground">{record.crop}</td>
                  <td className="px-4 py-2 text-right text-foreground">{record.treeCount}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{record.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
