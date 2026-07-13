"use client"

import { cn } from "@/lib/utils"
import { statusColors, type Zone, type ZoneId } from "@/lib/irrigation-data"
import { Panel } from "@/components/farm/panel"

interface IrrigationZoneTableProps {
  zones: Zone[]
  onSelectZone?: (zoneId: ZoneId) => void
  selectedZoneId?: ZoneId
}

export function IrrigationZoneTable({ zones, onSelectZone, selectedZoneId }: IrrigationZoneTableProps) {
  return (
    <Panel title="Irrigation by Zone">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-2.5 py-2 text-left font-semibold text-foreground">Zone</th>
              <th className="px-2.5 py-2 text-left font-semibold text-foreground">Motor</th>
              <th className="px-2.5 py-2 text-left font-semibold text-foreground">Valve Open Time</th>
              <th className="px-2.5 py-2 text-right font-semibold text-foreground">Total Water (L)</th>
              <th className="px-2.5 py-2 text-right font-semibold text-foreground">Records</th>
              <th className="px-2.5 py-2 text-right font-semibold text-foreground">Water/Tree (L)</th>
              <th className="px-2.5 py-2 text-left font-semibold text-foreground">Last Irrigated</th>
              <th className="px-2.5 py-2 text-left font-semibold text-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr
                key={zone.id}
                onClick={() => onSelectZone?.(zone.id)}
                className={cn(
                  "border-b border-border transition-colors",
                  selectedZoneId === zone.id ? "bg-primary/5" : "hover:bg-muted/40 cursor-pointer",
                )}
              >
                <td className="px-2.5 py-3 font-semibold text-foreground">{zone.name}</td>
                <td className="px-2.5 py-3 text-muted-foreground">{zone.motor}</td>
                <td className="px-2.5 py-3 text-muted-foreground">{zone.valveOpenTime}</td>
                <td className="px-2.5 py-3 text-right font-semibold text-foreground">
                  {zone.totalWaterSupplied.toLocaleString("en-IN")}
                </td>
                <td className="px-2.5 py-3 text-right text-muted-foreground">{zone.recordsCount}</td>
                <td className="px-2.5 py-3 text-right font-medium text-foreground">{zone.waterPerTreeDisplay}</td>
                <td className="px-2.5 py-3 text-muted-foreground text-xs">{zone.lastIrrigatedDate}</td>
                <td className="px-2.5 py-3">
                  <span
                    className={cn(
                      "inline-block rounded-full px-2 py-1 text-xs font-semibold",
                      statusColors[zone.status].bg,
                      statusColors[zone.status].text,
                    )}
                  >
                    {zone.statusLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
