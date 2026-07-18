"use client"

import { cn } from "@/lib/utils"
import {
  ZONE_CONFIG,
  type ZoneId,
  type IrrigationStatus,
  getZoneDetails,
  formatRuntimeMinutes,
  formatWaterLitres,
} from "@/lib/irrigation-mock-data"

interface ZoneStatusCardsProps {
  dateStr: string
  selectedZoneId: ZoneId
  onSelectZone: (zoneId: ZoneId) => void
}

const statusColors: Record<IrrigationStatus, { bg: string; border: string; badge: string }> = {
  irrigated: { bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-800" },
  "no-record": { bg: "bg-gray-50", border: "border-gray-200", badge: "bg-gray-100 text-gray-800" },
  partial: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-800" },
  issue: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-800" },
}

const statusLabels: Record<IrrigationStatus, string> = {
  irrigated: "Irrigated",
  "no-record": "No Record",
  partial: "Partial",
  issue: "Issue",
}

export function ZoneStatusCards({ dateStr, selectedZoneId, onSelectZone }: ZoneStatusCardsProps) {
  const zones = Object.keys(ZONE_CONFIG) as ZoneId[]
  const zoneDetails = zones.map((zoneId) => getZoneDetails(zoneId, dateStr))

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
      {zoneDetails.map((zone) => {
        const isSelected = selectedZoneId === zone.zoneId
        const colors = statusColors[zone.status]
        const config = ZONE_CONFIG[zone.zoneId]

        return (
          <button
            key={zone.zoneId}
            onClick={() => onSelectZone(zone.zoneId)}
            className={cn(
              "rounded-lg border-2 p-3 text-left transition-all",
              isSelected
                ? `${colors.bg} ${colors.border} border-2 ring-2 ring-primary ring-offset-1`
                : `${colors.bg} border-gray-200 hover:border-gray-300`,
            )}
          >
            {/* Zone header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="text-xs font-bold text-muted-foreground">{zone.abbr}</div>
                <div className="text-sm font-semibold text-foreground">{zone.name}</div>
              </div>
              <span className={cn("rounded px-2 py-0.5 text-xs font-medium", colors.badge)}>
                {statusLabels[zone.status]}
              </span>
            </div>

            {/* Zone details */}
            <div className="space-y-1 text-xs text-muted-foreground">
              {zone.totalRuntimeMinutes > 0 && (
                <div>
                  <span className="font-medium">Runtime:</span> {formatRuntimeMinutes(zone.totalRuntimeMinutes)}
                </div>
              )}
              {zone.totalWaterLitres > 0 && (
                <div>
                  <span className="font-medium">Water:</span> {formatWaterLitres(zone.totalWaterLitres)}
                </div>
              )}
              {zone.waterPerTreeLitres > 0 && (
                <div>
                  <span className="font-medium">Per Tree:</span> {formatWaterLitres(zone.waterPerTreeLitres)}
                </div>
              )}
              {zone.lastIrrigationTime && (
                <div>
                  <span className="font-medium">Time:</span> {zone.lastIrrigationTime}
                </div>
              )}

              {/* Nutmeg overlap label */}
              {config.overlaps && config.overlaps.length > 0 && (
                <div className="mt-2 rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                  Overlaps {config.overlaps.join(", ")}
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
