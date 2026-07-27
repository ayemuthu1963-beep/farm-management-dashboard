"use client"

import { Droplets } from "lucide-react"
import { cn } from "@/lib/utils"
import { Panel } from "@/components/farm/panel"
import { ZONE_CONFIG, type ZoneId, getZoneDetails, formatRuntimeMinutes, formatWaterLitres } from "@/lib/irrigation-mock-data"

const statusColors = {
  irrigated: { svg: "#10b981" },
  "no-record": { svg: "#d1d5db" },
  partial: { svg: "#f59e0b" },
  issue: { svg: "#ef4444" },
}

interface IrrigationMapWithDetailsProps {
  dateStr: string
  selectedZoneId: ZoneId
  onSelectZone: (zoneId: ZoneId) => void
}

export function IrrigationMapWithDetails({ dateStr, selectedZoneId, onSelectZone }: IrrigationMapWithDetailsProps) {
  const selectedZone = getZoneDetails(selectedZoneId, dateStr)

  const zoneShapes = [
    { id: "P1E" as const, label: "PLOT 1\nEAST", path: "M 10 10 L 30 10 L 30 30 L 10 30 Z", labelX: 20, labelY: 20 },
    { id: "P1W" as const, label: "PLOT 1\nWEST", path: "M 10 40 L 30 40 L 30 60 L 10 60 Z", labelX: 20, labelY: 50 },
    { id: "P2E" as const, label: "PLOT 2\nEAST", path: "M 70 10 L 90 10 L 90 30 L 70 30 Z", labelX: 80, labelY: 20 },
    { id: "P2W" as const, label: "PLOT 2\nWEST", path: "M 70 40 L 90 40 L 90 60 L 70 60 Z", labelX: 80, labelY: 50 },
    { id: "JF" as const, label: "JACKFRUIT", path: "M 38 70 L 62 70 L 62 90 L 38 90 Z", labelX: 50, labelY: 80 },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Map panel */}
      <div className="lg:col-span-2">
        <Panel title="Farm Irrigation Map" icon={Droplets}>
          <svg viewBox="0 0 100 100" className="w-full h-auto bg-gradient-to-br from-slate-50 to-slate-100 rounded border border-border/50">
            <defs>
              <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
                <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#e5e7eb" strokeWidth="0.2" />
              </pattern>
              <pattern id="hatching" patternUnits="userSpaceOnUse" width="1.5" height="1.5">
                <path d="M -0.5,0.5 l 1,-1 M 0,1.5 l 1,-1 M 0.5,0.5 l 1,-1" stroke="#92400e" strokeWidth="0.3" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />

            {/* Physical zones */}
            {zoneShapes.map((shape) => {
              const zoneDetails = getZoneDetails(shape.id, dateStr)
              const isSelected = selectedZoneId === shape.id
              const statusColor = statusColors[zoneDetails.status]

              return (
                <g key={shape.id}>
                  <path
                    d={shape.path}
                    fill={statusColor.svg}
                    fillOpacity={isSelected ? 0.4 : 0.15}
                    stroke={statusColor.svg}
                    strokeWidth="1.5"
                    className="transition-all cursor-pointer hover:fill-opacity-30"
                    onClick={() => onSelectZone(shape.id)}
                  />
                  <text
                    x={shape.labelX}
                    y={shape.labelY}
                    fontSize="3"
                    fontWeight="700"
                    fill="#1f2937"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="pointer-events-none"
                  >
                    {shape.label}
                  </text>
                </g>
              )
            })}

            {/* Nutmeg overlay on P1E and P2W */}
            {selectedZoneId === "NM" && (
              <>
                <path
                  d="M 14 14 L 26 14 L 26 26 L 14 26 Z"
                  fill="url(#hatching)"
                  stroke="#b45309"
                  strokeWidth="1"
                  strokeDasharray="2,1.5"
                  className="transition-all"
                />
                <path
                  d="M 74 44 L 86 44 L 86 56 L 74 56 Z"
                  fill="url(#hatching)"
                  stroke="#b45309"
                  strokeWidth="1"
                  strokeDasharray="2,1.5"
                  className="transition-all"
                />
                <text
                  x="20"
                  y="20"
                  fontSize="2.5"
                  fontWeight="700"
                  fill="#92400e"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  opacity="0.8"
                  className="pointer-events-none"
                >
                  NM
                </text>
              </>
            )}

            {/* Nutmeg overlay reference on all views */}
            {selectedZoneId !== "NM" && (
              <>
                <path
                  d="M 14 14 L 26 14 L 26 26 L 14 26 Z"
                  fill="url(#hatching)"
                  stroke="#d97706"
                  strokeWidth="0.8"
                  strokeDasharray="2,1.5"
                  opacity="0.3"
                  className="transition-all cursor-pointer hover:opacity-50"
                  onClick={() => onSelectZone("NM")}
                />
                <path
                  d="M 74 44 L 86 44 L 86 56 L 74 56 Z"
                  fill="url(#hatching)"
                  stroke="#d97706"
                  strokeWidth="0.8"
                  strokeDasharray="2,1.5"
                  opacity="0.3"
                  className="transition-all cursor-pointer hover:opacity-50"
                  onClick={() => onSelectZone("NM")}
                />
              </>
            )}

            {/* Map legend */}
            <text x="2" y="98" fontSize="2" fill="#666" className="pointer-events-none">
              Green=Irrigated | Gray=No Record | Amber=Partial | Hatched=Nutmeg
            </text>
          </svg>
        </Panel>
      </div>

      {/* Selected zone detail panel */}
      <div>
        <Panel title="Zone Details">
          <div className="space-y-4">
            {/* Zone header */}
            <div className="border-b pb-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Zone</div>
              <div className="mt-1 text-lg font-bold text-foreground">{selectedZone.name}</div>
              <div className="text-xs text-muted-foreground">{selectedZone.abbr}</div>
            </div>

            {/* Overlap info for Nutmeg */}
            {selectedZone.overlaps && selectedZone.overlaps.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs font-medium text-amber-900">
                  Operational overlay spanning {selectedZone.overlaps.join(" and ")}
                </p>
              </div>
            )}

            {/* Zone info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Crop</div>
                <div className="mt-0.5 capitalize text-foreground">{selectedZone.crop}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Trees</div>
                <div className="mt-0.5 text-foreground">{selectedZone.treeCount}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Status</div>
                <div className="mt-0.5 capitalize text-foreground font-medium">{selectedZone.status}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Records</div>
                <div className="mt-0.5 text-foreground">{selectedZone.recordCount}</div>
              </div>
            </div>

            {/* Irrigation data */}
            <div className="border-t pt-3">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Runtime:</span>
                  <span className="text-foreground">{formatRuntimeMinutes(selectedZone.totalRuntimeMinutes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Water Pumped:</span>
                  <span className="text-foreground">{formatWaterLitres(selectedZone.totalWaterLitres)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Per Tree:</span>
                  <span className="text-foreground">{formatWaterLitres(selectedZone.waterPerTreeLitres)}</span>
                </div>
              </div>
            </div>

            {/* Last irrigation */}
            {selectedZone.lastIrrigationTime && (
              <div className="border-t pt-3">
                <div className="text-xs font-medium text-muted-foreground">Last Irrigation</div>
                <div className="mt-1 text-sm text-foreground">
                  {selectedZone.lastIrrigationDate} at {selectedZone.lastIrrigationTime}
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
