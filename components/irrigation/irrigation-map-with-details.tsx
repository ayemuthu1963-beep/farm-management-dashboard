"use client"

import { Map } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { cn } from "@/lib/utils"
import { formatWaterLitres, statusColors, type Zone, type ZoneFiveDayHistory, type ZoneId } from "@/lib/irrigation-data"
import type { MotorRunScheduleRow } from "@/lib/irrigation-plan"
import {
  compareActualWater,
  formatActualWater,
  scheduledWaterForZoneDate,
  type ActualWaterComparison,
  type ScheduleLoadStatus,
} from "@/lib/irrigation-schedule-comparison"

interface Props {
  zones: Zone[]
  selectedZoneId: ZoneId
  onSelectZone: (zoneId: ZoneId) => void
  isLoading?: boolean
  persistedScheduleRows: MotorRunScheduleRow[]
  scheduleLoadStatus: ScheduleLoadStatus
  scheduleLoadError: string | null
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

const ACTUAL_TONE_CLASSES: Record<ActualWaterComparison["tone"], string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  red: "bg-red-100 text-red-950 ring-red-300",
  yellow: "bg-amber-100 text-amber-950 ring-amber-300",
  "light-green": "bg-emerald-100 text-emerald-950 ring-emerald-300",
  "dark-green": "bg-emerald-700 text-white ring-emerald-800",
}

function AreaBox({
  zone,
  selected,
  onSelect,
  persistedScheduleRows,
  scheduleLoadStatus,
}: {
  zone: Zone
  selected: boolean
  onSelect: () => void
  persistedScheduleRows: MotorRunScheduleRow[]
  scheduleLoadStatus: ScheduleLoadStatus
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-full min-h-[330px] min-w-0 flex-col overflow-hidden rounded-xl border text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring",
        ZONE_TILE_APPEARANCE[zone.id].card,
        selected ? "ring-2 ring-primary/20" : null,
      )}
      aria-pressed={selected}
    >
      <div className="border-b border-border/60 px-2.5 py-2">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0">
            <div className="text-sm font-extrabold uppercase leading-tight tracking-wide text-foreground">{zone.name}</div>
            <div className="mt-0.5 text-[10px] font-semibold leading-tight text-muted-foreground">{zone.crop} · {zone.physicalPlot}</div>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{zone.abbr}</span>
        </div>
        <div className="mt-1.5 space-y-1">
          <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold leading-tight", statusColors[zone.status].bg, statusColors[zone.status].border, statusColors[zone.status].text)}>
            {zone.statusLabel}
          </span>
          <div className="break-words text-[10px] font-medium leading-tight text-muted-foreground">{zone.configuredMotorValves.join(" / ")}</div>
        </div>
      </div>

      <div className="flex-1 space-y-1 px-2.5 py-2">
        <div className="grid grid-cols-[2.3rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1 border-b border-border/70 px-1 pb-1 text-[9px] font-extrabold uppercase leading-tight tracking-wide text-muted-foreground" role="row">
          <span className="text-left" role="columnheader">Date</span>
          <span className="text-right" role="columnheader">Scheduled</span>
          <span className="text-right" role="columnheader">Actual</span>
        </div>
        {(zone.fiveDayHistory ?? []).map((day: ZoneFiveDayHistory) => {
          const scheduled = scheduledWaterForZoneDate(persistedScheduleRows, scheduleLoadStatus, zone.id, day.date)
          const comparison = compareActualWater(scheduled, day.perTreeLitres, day.isCurrentIncompleteDay)
          const actualDisplay = formatActualWater(day)
          return (
            <div key={`${zone.id}-${day.date}`} className="grid grid-cols-[2.3rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1 rounded-md bg-muted/25 px-1 py-1 text-[9px] leading-tight tabular-nums" role="row">
              <div className="min-w-0 text-left" role="cell">
                <div className="whitespace-nowrap font-semibold text-muted-foreground">{day.displayDate}</div>
                {day.isCurrentIncompleteDay ? <div className="text-[8px] font-bold uppercase leading-none tracking-wide text-amber-700">In progress</div> : null}
              </div>
              <div className="min-w-0 whitespace-nowrap text-right font-semibold text-foreground" role="cell">
                {scheduled.display}
              </div>
              <div className="min-w-0 text-right" role="cell">
                {actualDisplay ? (
                  <span
                    className={cn("inline-flex max-w-full items-center justify-end whitespace-nowrap rounded px-1 py-0.5 font-extrabold ring-1 ring-inset", ACTUAL_TONE_CLASSES[comparison.tone])}
                    data-water-status={comparison.status}
                    aria-label={`${actualDisplay}. ${comparison.explanation}.`}
                    title={comparison.explanation}
                  >
                    {actualDisplay}
                  </span>
                ) : (
                  <span className="sr-only" data-water-status={comparison.status}>{comparison.explanation}</span>
                )}
              </div>
            </div>
          )
        })}
        {zone.fiveDayHistory?.length ? null : (
          <div className="rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">Seven-day history unavailable.</div>
        )}
        <dl className="grid grid-cols-2 gap-1.5 border-t border-border/60 pt-2 text-[10px] leading-tight">
          <div className="rounded-md bg-background/70 p-1.5">
            <dt className="font-medium text-muted-foreground">Runtime</dt>
            <dd className="mt-0.5 text-[11px] font-bold text-foreground">{zone.valveOpenTime}</dd>
          </div>
          <div className="rounded-md bg-background/70 p-1.5">
            <dt className="font-medium text-muted-foreground">Water Pumped</dt>
            <dd className="mt-0.5 text-[11px] font-bold text-foreground">{formatWaterLitres(zone.totalWaterSupplied)}</dd>
          </div>
          <div className="rounded-md bg-background/70 p-1.5">
            <dt className="font-medium text-muted-foreground">Per Tree</dt>
            <dd className="mt-0.5 text-[11px] font-bold text-foreground">{zone.waterPerTree.toLocaleString("en-IN")} L</dd>
          </div>
          <div className="rounded-md bg-background/70 p-1.5">
            <dt className="font-medium text-muted-foreground">Records</dt>
            <dd className="mt-0.5 text-[11px] font-bold text-foreground">{zone.recordsCount}</dd>
          </div>
        </dl>
      </div>
    </button>
  )
}

export function IrrigationMapWithDetails({
  zones,
  selectedZoneId,
  onSelectZone,
  isLoading = false,
  persistedScheduleRows,
  scheduleLoadStatus,
  scheduleLoadError,
}: Props) {
  const displayZones = [...zones].sort((left, right) => DISPLAY_ZONE_ORDER.indexOf(left.id) - DISPLAY_ZONE_ORDER.indexOf(right.id))

  return (
    <Panel title="Farm Irrigation Table" icon={Map} headerRight={<span className="text-xs text-muted-foreground">Seven-day scheduled vs actual</span>}>
      {scheduleLoadStatus === "unavailable" ? (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950" role="status">
          Motor Run Schedule is unavailable. Scheduled values cannot be compared; actual irrigation data is unchanged{scheduleLoadError ? `: ${scheduleLoadError}` : "."}
        </div>
      ) : null}
      {isLoading ? (
        <div className="flex h-[340px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Loading live irrigation map...
        </div>
      ) : (
        <div
          className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-gradient-to-br from-slate-50 to-emerald-50 p-2 sm:p-3"
          role="region"
          aria-label="Farm Irrigation Map zones; scroll horizontally on smaller screens"
          tabIndex={0}
        >
          <div className="grid min-w-[96rem] grid-cols-6 items-stretch gap-2 xl:min-w-0">
            {displayZones.map((zone) => (
              <AreaBox
                key={zone.id}
                zone={zone}
                selected={selectedZoneId === zone.id}
                onSelect={() => onSelectZone(zone.id)}
                persistedScheduleRows={persistedScheduleRows}
                scheduleLoadStatus={scheduleLoadStatus}
              />
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}
