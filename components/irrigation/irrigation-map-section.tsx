"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { zones, statusColors, type ZoneId } from "@/lib/irrigation-data"
import { Panel } from "@/components/farm/panel"
import { Droplets } from "lucide-react"

export function IrrigationMapSection() {
  const [selectedZoneId, setSelectedZoneId] = useState<ZoneId>("P1E")
  const selectedZone = zones.find((z) => z.id === selectedZoneId)

  // SVG zone map layout — normalized coordinates as percentages
  const zoneShapes = [
    { id: "P1E" as const, label: "Plot 1 East", path: "M 20 15 L 40 15 L 40 45 L 20 45 Z" },
    { id: "P1W" as const, label: "Plot 1 West", path: "M 20 50 L 40 50 L 40 80 L 20 80 Z" },
    { id: "P2E" as const, label: "Plot 2 East", path: "M 60 15 L 80 15 L 80 45 L 60 45 Z" },
    { id: "P2W" as const, label: "Plot 2 West", path: "M 60 50 L 80 50 L 80 80 L 60 80 Z" },
    { id: "JF" as const, label: "Jackfruit", path: "M 35 85 L 65 85 L 65 100 L 35 100 Z" },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Map panel */}
      <div className="lg:col-span-2">
        <Panel title="Farm Irrigation Map" icon={Droplets}>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-border p-6 relative">
            {/* SVG Map */}
            <svg viewBox="0 0 100 100" className="w-full h-auto bg-white rounded border border-border/50">
              {/* Background farm grid */}
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e5e7eb" strokeWidth="0.2" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />

              {/* Zone polygons */}
              {zoneShapes.map((shape) => {
                const zone = zones.find((z) => z.id === shape.id)
                if (!zone) return null
                const isSelected = selectedZoneId === shape.id
                const statusColor = statusColors[zone.status]
                return (
                  <g key={shape.id}>
                    <path
                      d={shape.path}
                      fill={statusColor.svg}
                      fillOpacity={isSelected ? 0.4 : 0.2}
                      stroke={statusColor.svg}
                      strokeWidth="1"
                      className="transition-all cursor-pointer hover:fill-opacity-35"
                      onClick={() => setSelectedZoneId(shape.id)}
                    />
                    {/* Zone label + water per tree */}
                    {shape.id === "P1E" && (
                      <>
                        <text x="30" y="25" fontSize="3" fontWeight="600" fill="#1f2937" textAnchor="middle">
                          {shape.label}
                        </text>
                        <text x="30" y="35" fontSize="2" fill="#6b7280" textAnchor="middle">
                          {zone.waterPerTree} L/tree
                        </text>
                      </>
                    )}
                    {shape.id === "P1W" && (
                      <>
                        <text x="30" y="60" fontSize="3" fontWeight="600" fill="#1f2937" textAnchor="middle">
                          {shape.label}
                        </text>
                        <text x="30" y="70" fontSize="2" fill="#6b7280" textAnchor="middle">
                          {zone.waterPerTree} L/tree
                        </text>
                      </>
                    )}
                    {shape.id === "P2E" && (
                      <>
                        <text x="70" y="25" fontSize="3" fontWeight="600" fill="#1f2937" textAnchor="middle">
                          {shape.label}
                        </text>
                        <text x="70" y="35" fontSize="2" fill="#6b7280" textAnchor="middle">
                          {zone.waterPerTree} L/tree
                        </text>
                      </>
                    )}
                    {shape.id === "P2W" && (
                      <>
                        <text x="70" y="60" fontSize="3" fontWeight="600" fill="#1f2937" textAnchor="middle">
                          {shape.label}
                        </text>
                        <text x="70" y="70" fontSize="2" fill="#6b7280" textAnchor="middle">
                          {zone.waterPerTree} L/tree
                        </text>
                      </>
                    )}
                    {shape.id === "JF" && (
                      <>
                        <text x="50" y="90" fontSize="3" fontWeight="600" fill="#1f2937" textAnchor="middle">
                          {shape.label}
                        </text>
                        <text x="50" y="97" fontSize="2" fill="#6b7280" textAnchor="middle">
                          {zone.waterPerTree} L/tree
                        </text>
                      </>
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
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Plot</dt>
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
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Number of Trees</dt>
              <dd className="mt-0.5 text-foreground">{selectedZone.numberOfTrees}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Water per Tree</dt>
              <dd className="mt-0.5 text-foreground font-semibold">{selectedZone.waterPerTree} L</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Last Irrigated</dt>
              <dd className="mt-0.5 text-foreground">{selectedZone.lastIrrigatedDate}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Days Since Irrigation</dt>
              <dd className="mt-0.5 text-foreground">{selectedZone.daysSinceIrrigation}</dd>
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
