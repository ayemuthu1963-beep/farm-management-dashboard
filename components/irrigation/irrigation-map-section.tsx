"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { statusColors, type Zone, type ZoneId } from "@/lib/irrigation-data"
import { Panel } from "@/components/farm/panel"
import { Droplets } from "lucide-react"

interface IrrigationMapSectionProps {
  zones: Zone[]
}

export function IrrigationMapSection({ zones }: IrrigationMapSectionProps) {
  const [selectedZoneId, setSelectedZoneId] = useState<ZoneId>("P1E")
  const selectedZone = zones.find((z) => z.id === selectedZoneId)

  // SVG zone map layout — all five zones visible without scrolling
  const zoneShapes = [
    { id: "P1E" as const, label: "PLOT 1 EAST", path: "M 8 8 L 28 8 L 28 28 L 8 28 Z", labelX: 18, labelY: 18 },
    { id: "P1W" as const, label: "PLOT 1 WEST", path: "M 8 38 L 28 38 L 28 58 L 8 58 Z", labelX: 18, labelY: 48 },
    { id: "P2E" as const, label: "PLOT 2 EAST", path: "M 72 8 L 92 8 L 92 28 L 72 28 Z", labelX: 82, labelY: 18 },
    { id: "P2W" as const, label: "PLOT 2 WEST", path: "M 72 38 L 92 38 L 92 58 L 72 58 Z", labelX: 82, labelY: 48 },
    { id: "JF" as const, label: "JACKFRUIT", path: "M 36 68 L 64 68 L 64 88 L 36 88 Z", labelX: 50, labelY: 78 },
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
                      fillOpacity={isSelected ? 0.35 : 0.15}
                      stroke={statusColor.svg}
                      strokeWidth="1.5"
                      className="transition-all cursor-pointer hover:fill-opacity-3"
                      onClick={() => setSelectedZoneId(shape.id)}
                    />
                    {/* Zone label — large, bold */}
                    <text
                      x={shape.labelX}
                      y={shape.labelY}
                      fontSize="4"
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
