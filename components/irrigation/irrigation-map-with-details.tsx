"use client"

import { Droplets, Map } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { cn } from "@/lib/utils"
import { formatWaterLitres, statusColors, type Zone, type ZoneFiveDayHistory, type ZoneId } from "@/lib/irrigation-data"

interface Props {
  zones: Zone[]
  selectedZoneId: ZoneId
  onSelectZone: (zoneId: ZoneId) => void
  isLoading?: boolean
}

const DISPLAY_ZONE_ORDER: ZoneId[] = ["P1W", "P1E", "P2W", "P2E", "JF", "NM"]
const ZONE_TILE_APPEARANCE: Record<ZoneId, { card: string }> = {
  P1W: { card: "border-chart-1/30 bg-chart-1/10" },
  P1E: { card: "border-chart-2/30 bg-chart-2/10" },
  P2W: { card: "border-chart-3/30 bg-chart-3/10" },
  P2E: { card: "border-chart-4/30 bg-chart-4/10" },
  JF: { card: "border-chart-5/30 bg-chart-5/10" },
  NM: { card: "border-primary/30 bg-primary/10" },
}

function getZone(zones: Zone[], id: ZoneId): Zone {
  return zones.find((zone) => zone.id === id) ?? zones[0]
}

function formatPerTreeValue(day: ZoneFiveDayHistory): string {
  return day.perTreeLitres === null ? "No Record" : `${day.perTreeLitres.toLocaleString("en-IN")} L/tree`
}

function AreaBox({
  zone,
  selected,
  onSelect,
}: {
  zone: Zone
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-h-[235px] flex-col overflow-hidden rounded-2xl border text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring",
        ZONE_TILE_APPEARANCE[zone.id].card,
        selected ? "ring-2 ring-primary/20" : null,
      )}
      aria-pressed={selected}
    >
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold uppercase tracking-wide text-foreground">{zone.name}</div>
            <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{zone.crop}</div>
          </div>
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{zone.abbr}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", statusColors[zone.status].bg, statusColors[zone.status].border, statusColors[zone.status].text)}>
            {zone.statusLabel}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">{zone.configuredMotorValves.join(" / ")}</span>
        </div>
      </div>

      <div className="flex-1 space-y-2 px-4 py-3">
        {(zone.fiveDayHistory ?? []).map((day) => (
          <div key={`${zone.id}-${day.date}`} className="grid grid-cols-[4.5rem_1fr] items-center gap-2 rounded-lg bg-muted/25 px-2.5 py-2 text-sm">
            <div>
              <div className="font-semibold text-muted-foreground">{day.displayDate}</div>
              {day.isCurrentIncompleteDay ? <div className="text-[10px] font-bold uppercase tracking-wide text-amber-600">In progress</div> : null}
            </div>
            <div className={cn("text-right font-bold", day.perTreeLitres === null ? "text-muted-foreground" : "text-foreground")}>
              {formatPerTreeValue(day)}
            </div>
          </div>
        ))}
        {zone.fiveDayHistory?.length ? null : (
          <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">Seven-day history unavailable.</div>
        )}
      </div>
    </button>
  )
}

export function IrrigationMapWithDetails({ zones, selectedZoneId, onSelectZone, isLoading = false }: Props) {
  const selectedZone = getZone(zones, selectedZoneId)
  const displayZones = [...zones].sort((left, right) => DISPLAY_ZONE_ORDER.indexOf(left.id) - DISPLAY_ZONE_ORDER.indexOf(right.id))

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Panel title="Farm Irrigation Map" icon={Map} headerRight={<span className="text-xs text-muted-foreground">Seven-day water per tree</span>}>
          {isLoading ? (
            <div className="flex h-[420px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Loading live irrigation map...
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-gradient-to-br from-slate-50 to-emerald-50 p-3 sm:p-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {displayZones.map((zone) => (
                  <AreaBox key={zone.id} zone={zone} selected={selectedZoneId === zone.id} onSelect={() => onSelectZone(zone.id)} />
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Selected Zone Details" icon={Droplets}>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{selectedZone.abbr}</div>
                <div className="mt-1 text-xl font-extrabold text-foreground">{selectedZone.name}</div>
                <div className="text-sm text-muted-foreground">{selectedZone.physicalPlot}</div>
              </div>
              <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold", statusColors[selectedZone.status].bg, statusColors[selectedZone.status].border, statusColors[selectedZone.status].text)}>
                {selectedZone.statusLabel}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="text-sm font-semibold text-foreground">Seven-day water per tree</div>
            <div className="mt-2 space-y-2">
              {(selectedZone.fiveDayHistory ?? []).map((day) => (
                <div key={`selected-${selectedZone.id}-${day.date}`} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium text-muted-foreground">{day.displayDate}</span>
                    {day.isCurrentIncompleteDay ? <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-amber-600">In progress</span> : null}
                  </span>
                  <span className={cn("font-bold", day.perTreeLitres === null ? "text-muted-foreground" : "text-foreground")}>{formatPerTreeValue(day)}</span>
                </div>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-card p-3">
              <dt className="text-xs font-medium text-muted-foreground">Runtime</dt>
              <dd className="mt-1 font-bold text-foreground">{selectedZone.valveOpenTime}</dd>
            </div>
            <div className="rounded-lg bg-card p-3">
              <dt className="text-xs font-medium text-muted-foreground">Water Pumped</dt>
              <dd className="mt-1 font-bold text-foreground">{formatWaterLitres(selectedZone.totalWaterSupplied)}</dd>
            </div>
            <div className="rounded-lg bg-card p-3">
              <dt className="text-xs font-medium text-muted-foreground">Per Tree</dt>
              <dd className="mt-1 font-bold text-foreground">{selectedZone.waterPerTree.toLocaleString("en-IN")} L</dd>
            </div>
            <div className="rounded-lg bg-card p-3">
              <dt className="text-xs font-medium text-muted-foreground">Records</dt>
              <dd className="mt-1 font-bold text-foreground">{selectedZone.recordsCount}</dd>
            </div>
          </dl>

          <div className="rounded-lg border border-border p-3 text-sm">
            <div className="font-semibold text-foreground">Verified motor / valve mapping</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {selectedZone.configuredMotorValves.map((mapping) => (
                <li key={mapping}>{mapping}</li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
    </div>
  )
}
