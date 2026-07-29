"use client"

import { Droplets } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { irrigationZoneVisuals } from "@/components/irrigation/irrigation-zone-visuals"
import { cn } from "@/lib/utils"
import { formatWaterLitres, statusColors, type Zone } from "@/lib/irrigation-data"

interface IrrigationMapV2Props {
  zones: Zone[]
  isLoading?: boolean
}

function ZoneTile({ zone, isLoading }: { zone: Zone; isLoading: boolean }) {
  const visual = irrigationZoneVisuals[zone.id]
  const status = statusColors[zone.status]

  return (
    <div
      className={cn(
        "rounded-xl border p-4 text-center shadow-sm",
        visual.background,
        visual.border,
      )}
    >
      <div className="text-sm font-extrabold uppercase tracking-wide text-foreground">
        {zone.name}
      </div>
      <div className="mt-3 text-2xl font-black text-foreground">
        {isLoading ? "—" : formatWaterLitres(zone.totalWaterSupplied)}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {isLoading ? "Loading live irrigation data..." : zone.waterPerTreeDisplay}
      </div>
      <span
        className={cn(
          "mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold",
          status.bg,
          status.border,
          status.text,
        )}
      >
        {isLoading ? "Loading..." : zone.statusLabel}
      </span>
    </div>
  )
}

export function IrrigationMapV2({ zones, isLoading = false }: IrrigationMapV2Props) {
  const firstRow = zones.slice(0, 4)
  const secondRow = zones.slice(4, 6)

  return (
    <Panel title="Farm Irrigation Map" icon={Droplets}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {firstRow.map((zone) => (
            <ZoneTile key={zone.id} zone={zone} isLoading={isLoading} />
          ))}
        </div>
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3">
          {secondRow.map((zone) => (
            <ZoneTile key={zone.id} zone={zone} isLoading={isLoading} />
          ))}
        </div>
      </div>
    </Panel>
  )
}
