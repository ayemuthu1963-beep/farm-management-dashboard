"use client"

import { useState, useMemo } from "react"
import { Panel } from "@/components/farm/panel"
import { IRRIGATION_RECORDS, ZONE_CONFIG, formatWaterLitres, formatRuntimeMinutes, type ZoneId } from "@/lib/irrigation-mock-data"
import { ChevronDown, ChevronUp, Search } from "lucide-react"

interface IrrigationZoneTableProps {
  dateStr: string
}

const RECORDS_PER_PAGE = 10

export function IrrigationZoneTableHybrid({ dateStr }: IrrigationZoneTableProps) {
  // Sort state
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "startTime", direction: "asc" })
  
  // Filter states
  const [zoneFilter, setZoneFilter] = useState<ZoneId | "all">("all")
  const [motorFilter, setMotorFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("selected") // "selected", "yesterday", "range"
  const [searchQuery, setSearchQuery] = useState("")
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  
  // Loading state
  const isLoading = false

  // Get all unique motors from records
  const availableMotors = useMemo(() => {
    const motors = new Set(IRRIGATION_RECORDS.map((r) => r.motor))
    return Array.from(motors).sort()
  }, [])

  // Apply filters
  const filteredRecords = useMemo(() => {
    let records = [...IRRIGATION_RECORDS]

    // Date filter
    if (dateFilter === "selected") {
      records = records.filter((r) => r.date === dateStr)
    } else if (dateFilter === "yesterday") {
      const yesterdayDate = new Date(dateStr)
      yesterdayDate.setDate(yesterdayDate.getDate() - 1)
      records = records.filter((r) => r.date === yesterdayDate.toISOString().split("T")[0])
    }
    // "range" would require additional date pickers - not implemented for now

    // Zone filter
    if (zoneFilter !== "all") {
      records = records.filter((r) => r.zoneId === zoneFilter)
    }

    // Motor filter
    if (motorFilter !== "all") {
      records = records.filter((r) => r.motor === motorFilter)
    }

    // Search filter (searches multiple fields)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      records = records.filter((r) => {
        const searchable = [
          r.zoneId,
          ZONE_CONFIG[r.zoneId].name,
          ZONE_CONFIG[r.zoneId].crop,
          r.motor,
          r.valve,
          r.remarks || "",
        ].join(" ").toLowerCase()
        return searchable.includes(query)
      })
    }

    return records
  }, [dateStr, zoneFilter, motorFilter, dateFilter, searchQuery])

  // Sort records
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let aVal: any = a[sortConfig.key as keyof typeof a]
      let bVal: any = b[sortConfig.key as keyof typeof b]

      if (sortConfig.direction === "asc") {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })
  }, [filteredRecords, sortConfig])

  // Pagination
  const totalPages = Math.ceil(sortedRecords.length / RECORDS_PER_PAGE)
  const startIdx = (currentPage - 1) * RECORDS_PER_PAGE
  const endIdx = startIdx + RECORDS_PER_PAGE
  const paginatedRecords = sortedRecords.slice(startIdx, endIdx)

  const handleSort = (key: string) => {
    if (sortConfig.key === key) {
      setSortConfig({ key, direction: sortConfig.direction === "asc" ? "desc" : "asc" })
    } else {
      setSortConfig({ key, direction: "asc" })
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortConfig.key !== field) return <div className="w-4 h-4" />
    return sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
  }

  return (
    <Panel title="Detailed Irrigation Records">
      {/* Loading state */}
      {isLoading && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-600">Loading records...</p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Search bar */}
          <div className="mb-4 flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search zone, motor, valve, crop, remarks..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1) // Reset to page 1 when searching
              }}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">Date:</label>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="selected">Selected Date</option>
                <option value="yesterday">Yesterday</option>
              </select>
            </div>

            {/* Zone Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">Zone:</label>
              <select
                value={zoneFilter}
                onChange={(e) => {
                  setZoneFilter(e.target.value as ZoneId | "all")
                  setCurrentPage(1)
                }}
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Zones</option>
                {Object.entries(ZONE_CONFIG).map(([id, config]) => (
                  <option key={id} value={id}>
                    {config.name} ({config.abbr})
                  </option>
                ))}
              </select>
            </div>

            {/* Motor Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">Motor:</label>
              <select
                value={motorFilter}
                onChange={(e) => {
                  setMotorFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Motors</option>
                {availableMotors.map((motor) => (
                  <option key={motor} value={motor}>
                    {motor}
                  </option>
                ))}
              </select>
            </div>

            {/* Record count */}
            <span className="text-xs text-muted-foreground ml-auto">
              {sortedRecords.length} record{sortedRecords.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Empty state */}
          {sortedRecords.length === 0 ? (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-600">
                {searchQuery ? "No records match your search." : "No irrigation records for the selected filters."}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Table */}
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
                    {paginatedRecords.map((record, idx) => (
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Page {currentPage} of {totalPages} • Showing {paginatedRecords.length} of {sortedRecords.length} records
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="rounded-lg border border-input px-3 py-1 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <select
                      value={currentPage}
                      onChange={(e) => handlePageChange(Number(e.target.value))}
                      className="rounded-lg border border-input bg-background px-2 py-1 text-xs"
                    >
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <option key={page} value={page}>
                          {page}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="rounded-lg border border-input px-3 py-1 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Panel>
  )
}
