"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
<<<<<<< HEAD
import { zones, statusColors, type ZoneId, getOverlappingZones, isOverlappingZone } from "@/lib/irrigation-data"
=======
import { statusColors, type Zone, type ZoneId } from "@/lib/irrigation-data"
>>>>>>> 5fe26d4b753e22330e399bdf9ea738ac92de81ec
import { Panel } from "@/components/farm/panel"
import { Droplets } from "lucide-react"

interface IrrigationMapSectionProps {
  zones: Zone[]
}

export function IrrigationMapSection({ zones }: IrrigationMapSectionProps) {
  const [selectedZoneId, setSelectedZoneId] = useState<ZoneId>("P1E")
  const selectedZone = zones.find((z) => z.id === selectedZoneId)

  // SVG zone map layout — six zones including Nutmeg overlay
  const zoneShapes = [
    { id: "P1E" as const, label: "PLOT 1 EAST", path: "M 8 8 L 28 8 L 28 28 L 8 28 Z", labelX: 18, labelY: 18, isPhysicalZone: true },
    { id: "P1W" as const, label: "PLOT 1 WEST", path: "M 8 38 L 28 38 L 28 58 L 8 58 Z", labelX: 18, labelY: 48, isPhysicalZone: true },
    { id: "P2E" as const, label: "PLOT 2 EAST", path: "M 72 8 L 92 8 L 92 28 L 72 28 Z", labelX: 82, labelY: 18, isPhysicalZone: true },
    { id: "P2W" as const, label: "PLOT 2 WEST", path: "M 72 38 L 92 38 L 92 58 L 72 58 Z", labelX: 82, labelY: 48, isPhysicalZone: true },
    { id: "JF" as const, label: "JACKFRUIT", path: "M 36 68 L 64 68 L 64 88 L 36 88 Z", labelX: 50, labelY: 78, isPhysicalZone: true },
    // Nutmeg overlay — spans portions of P1E and P2W with hatched pattern
    { id: "NM" as const, label: "NUTMEG", path: "M 12 12 L 24 12 L 24 24 L 12 24 Z", labelX: 18, labelY: 18, isPhysicalZone: false, isOverlay: true },
    { id: "NM" as const, label: "", path: "M 76 42 L 88 42 L 88 54 L 76 54 Z", labelX: 0, labelY: 0, isPhysicalZone: false, isOverlay: true },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Map panel */}
      <div className="lg:col-span-2">
        <Panel title="Farm Irrigation Map" icon={Droplets}>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-border p-6 relative">
            {/* SVG Map */}
            <svg viewBox="0 0 100 100" className="w-full h-auto bg-white rounded border border-border/50">
              {/* Background farm grid and hatching pattern for overlays */}
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e5e7eb" strokeWidth="0.2" />
                </pattern>
                {/* Hatching pattern for Nutmeg overlay */}
                <pattern id="hatching" patternUnits="userSpaceOnUse" width="2" height="2">
                  <path d="M -1,1 l 2,-2 M 0,2 l 2,-2 M 1,1 l 2,-2" stroke="#666" strokeWidth="0.4" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />

              {/* Zone polygons — physical zones first, then overlays */}
              {zoneShapes
                .filter((s) => !s.isOverlay) // Draw physical zones first
                .map((shape, idx) => {
                  const zone = zones.find((z) => z.id === shape.id)
                  if (!zone) return null
                  const isSelected = selectedZoneId === shape.id
                  const statusColor = statusColors[zone.status]
                  return (
                    <g key={`${shape.id}-${idx}`}>
                      <path
                        d={shape.path}
                        fill={statusColor.svg}
                        fillOpacity={isSelected ? 0.35 : 0.15}
                        stroke={statusColor.svg}
                        strokeWidth="1.5"
                        className="transition-all cursor-pointer hover:fill-opacity-40"
                        onClick={() => setSelectedZoneId(shape.id)}
                      />
                      {/* Zone label */}
                      <text
                        x={shape.labelX}
                        y={shape.labelY}
                        fontSize="3.5"
                        fontWeight="700"
                        fill="#1f2937"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {shape.label}
                      </text>
                    </g>
                  )
                })}

              {/* Nutmeg overlay — semi-transparent with hatching */}
              {zoneShapes
                .filter((s) => s.isOverlay)
                .map((shape, idx) => {
                  const zone = zones.find((z) => z.id === "NM")
                  if (!zone) return null
                  const isSelected = selectedZoneId === "NM"
                  const statusColor = statusColors[zone.status]
                  return (
                    <g key={`nutmeg-overlay-${idx}`}>
                      {/* Hatched pattern background */}
                      <path
                        d={shape.path}
                        fill="url(#hatching)"
                        fillOpacity={isSelected ? 0.4 : 0.25}
                        stroke={statusColor.svg}
                        strokeWidth="1"
                        strokeDasharray="2,2"
                        className="transition-all cursor-pointer"
                        onClick={() => setSelectedZoneId("NM")}
                      />
                      {/* Label only for first Nutmeg patch */}
                      {idx === 0 && (
                        <text
                          x={shape.labelX}
                          y={shape.labelY}
                          fontSize="2.5"
                          fontWeight="700"
                          fill="#4b5563"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          opacity="0.7"
                        >
                          NM
                        </text>
                      )}
                    </g>
                  )
                })}
            </svg>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
              {Object.entries(statusColors).map(([status, { label, svg }]) => (
                <div key={status} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded border" style={{ backgroundColor: svg, borderColor: svg }} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* Selected zone detail panel */}
      {selectedZone && (
        <Panel title="Zone Details">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Zone Name</dt>
              <dd className="mt-0.5 text-base font-semibold text-foreground">{selectedZone.name}</dd>
            </div>
            {isOverlappingZone(selectedZone.id) && (
              <div className="rounded-md bg-amber-50/50 border border-amber-200/50 p-2.5">
                <p className="text-xs text-amber-900 font-medium">
                  This zone overlaps portions of {getOverlappingZones(selectedZone.id).map((z) => zones.find((zone) => zone.id === z)?.name).join(" and ")}
                </p>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Plot / Location</dt>
              <dd className="mt-0.5 text-foreground">{selectedZone.plot}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Motor</dt>
              <dd className="mt-0.5 text-foreground">{selectedZone.motor}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Valve Open Time</dt>
              <dd className="mt-0.5 text-foreground">{selectedZone.valveOpenTime}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Total Water Supplied</dt>
              <dd className="mt-0.5 text-foreground font-semibold">
                {selectedZone.totalWaterSupplied.toLocaleString("en-IN")} L
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Runtime Records</dt>
              <dd className="mt-0.5 text-foreground">{selectedZone.recordsCount}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Water per Tree</dt>
              <dd className="mt-0.5 text-foreground font-semibold">{selectedZone.waterPerTreeDisplay}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Last Irrigated</dt>
              <dd className="mt-0.5 text-foreground">{selectedZone.lastIrrigatedDate}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Days Since Irrigation</dt>
              <dd className="mt-0.5 text-foreground">--</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                <span
                  className={cn(
                    "inline-block rounded-full px-2.5 py-1 text-xs font-semibold",
                    statusColors[selectedZone.status].bg,
                    statusColors[selectedZone.status].text,
                  )}
                >
                  {selectedZone.statusLabel}
                </span>
              </dd>
            </div>
          </dl>
        </Panel>
      )}
    </div>
  )
}
