"use client"

import { irrigationZoneVisuals } from "@/components/irrigation/irrigation-zone-visuals"
import { cn } from "@/lib/utils"
import { formatWaterLitres, statusColors, type Zone } from "@/lib/irrigation-data"

interface ZoneStatusCardsProps {
  zones: Zone[]
  isLoading?: boolean
}

export function ZoneStatusCards({ zones, isLoading = false }: ZoneStatusCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
      {zones.map((zone) => {
        const palette = statusColors[zone.status]
        const visual = irrigationZoneVisuals[zone.id]
        return (
          <div
            key={zone.id}
            className={cn(
              "rounded-xl border p-3 text-center shadow-sm",
              visual.background,
              visual.border,
            )}
          >
            <div className="text-xs font-extrabold uppercase tracking-wide text-foreground">
              {zone.name}
            </div>
            <span
              className={cn(
                "mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold",
                palette.bg,
                palette.border,
                palette.text,
              )}
            >
              {isLoading ? "Loading..." : zone.statusLabel}
            </span>
            <div className="mt-3 text-sm font-bold text-foreground">
              {isLoading ? "—" : formatWaterLitres(zone.totalWaterSupplied)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {isLoading ? "Loading runtime" : zone.valveOpenTime}
            </div>
          </div>
        )
      })}
    </div>
  )
}
