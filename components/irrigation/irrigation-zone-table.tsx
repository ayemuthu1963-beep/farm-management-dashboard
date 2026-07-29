"use client"

import { Panel } from "@/components/farm/panel"
import { cn } from "@/lib/utils"
import { formatWaterLitres, statusColors, type Zone } from "@/lib/irrigation-data"

interface IrrigationZoneTableProps {
  zones: Zone[]
  isLoading?: boolean
  errorMessage?: string | null
}

export function IrrigationZoneTable({
  zones,
  isLoading = false,
  errorMessage = null,
}: IrrigationZoneTableProps) {
  return (
    <Panel title="Irrigation by Zone">
      {isLoading ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Loading live zone totals...
        </div>
      ) : errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-8 text-center text-sm font-medium text-destructive">
          {errorMessage}. Use Refresh to retry.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full border-collapse text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3 py-3 text-left font-semibold text-foreground">Zone</th>
                <th className="px-3 py-3 text-left font-semibold text-foreground">Motor / Valve Mapping</th>
                <th className="px-3 py-3 text-right font-semibold text-foreground">Runtime</th>
                <th className="px-3 py-3 text-right font-semibold text-foreground">Water Supplied</th>
                <th className="px-3 py-3 text-right font-semibold text-foreground">Water per Tree</th>
                <th className="px-3 py-3 text-right font-semibold text-foreground">Records</th>
                <th className="px-3 py-3 text-left font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => {
                const palette = statusColors[zone.status]
                return (
                  <tr key={zone.id} className="border-b border-border transition-colors hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-foreground">{zone.name}</div>
                      <div className="text-xs text-muted-foreground">{zone.abbr} · {zone.crop}</div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{zone.motor}</td>
                    <td className="px-3 py-3 text-right font-medium text-foreground">{zone.valveOpenTime}</td>
                    <td className="px-3 py-3 text-right font-semibold text-foreground">
                      {formatWaterLitres(zone.totalWaterSupplied)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-foreground">
                      {zone.totalRuntimeMinutes > 0 ? `${zone.waterPerTree.toLocaleString("en-IN")} L` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{zone.recordsCount}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                          palette.bg,
                          palette.border,
                          palette.text,
                        )}
                      >
                        {zone.statusLabel}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
