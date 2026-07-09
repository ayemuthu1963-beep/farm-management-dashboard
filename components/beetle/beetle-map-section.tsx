"use client"

import { useState } from "react"
import Image from "next/image"
import { Bug, MapPin, Trophy, Info } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { cn } from "@/lib/utils"
import {
  traps,
  topTraps,
  plotMaps,
  countBands,
  bandForCount,
  resetSchedule,
  type PlotId,
  type BeetleType,
  type RiskLevel,
} from "@/lib/beetle-data"

const riskBadge: Record<RiskLevel, string> = {
  "Very High": "bg-destructive/10 text-destructive",
  High: "bg-chart-3/15 text-chart-3",
  Medium: "bg-warning/25 text-warning-foreground",
  Low: "bg-chart-2/15 text-chart-2",
}

// Rhinoceros = black beetle, Red Palm Weevil = red beetle
const beetleColor: Record<BeetleType, string> = {
  Rhinoceros: "text-foreground",
  "Red Palm Weevil": "text-destructive",
}

export function BeetleMapSection() {
  const [activePlot, setActivePlot] = useState<PlotId>("plot1")
  const [selectedTrapNo, setSelectedTrapNo] = useState<string | null>(null)

  const activeMap = plotMaps.find((p) => p.id === activePlot) ?? plotMaps[0]
  const plotTraps = traps.filter((t) => t.plot === activePlot)
  const selectedTrap = traps.find((t) => t.trapNo === selectedTrapNo) ?? null

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      {/* Map */}
      <Panel
        title="Farm Map – Drone Orthomosaic"
        icon={MapPin}
        className="xl:col-span-2"
        headerRight={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
            {plotMaps.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePlot(p.id)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                  activePlot === p.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={activePlot === p.id}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      >
        {/* Orthomosaic + markers */}
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border bg-muted">
          <Image
            key={activeMap.id}
            src={activeMap.image || "/placeholder.svg"}
            alt={`${activeMap.label} drone orthomosaic (placeholder)`}
            fill
            sizes="(min-width: 1280px) 60vw, 100vw"
            className="object-cover"
          />

          {plotTraps.map((t) => {
            const band = bandForCount(t.cumulativeCount)
            const isSelected = t.trapNo === selectedTrapNo
            return (
              <button
                key={t.trapNo}
                type="button"
                onClick={() => setSelectedTrapNo(t.trapNo)}
                title={`${t.trapNo} · ${t.type} · ${t.cumulativeCount} since reset`}
                aria-label={`${t.trapNo}, ${t.type}, ${t.cumulativeCount} beetles since reset, ${t.risk} risk`}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-110 focus:outline-none"
                style={{ left: `${t.x}%`, top: `${t.y}%` }}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full border-2 border-card bg-card/85 shadow-md backdrop-blur-sm",
                    band.glow && "ring-2 ring-destructive/70 animate-pulse",
                    isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                  )}
                  style={{ width: band.sizePx, height: band.sizePx }}
                >
                  <Bug
                    className={beetleColor[t.type]}
                    style={{ width: band.sizePx * 0.62, height: band.sizePx * 0.62 }}
                    aria-hidden="true"
                  />
                </span>
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Beetle Count Since Last Reset
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-2">
            {countBands.map((b) => (
              <div key={b.band} className="flex items-center gap-2">
                <span className="flex w-6 items-center justify-center">
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-full border border-card bg-card shadow-sm",
                      b.glow && "ring-1 ring-destructive/60",
                    )}
                    style={{ width: Math.min(b.sizePx, 24), height: Math.min(b.sizePx, 24) }}
                  >
                    <Bug
                      className="text-foreground"
                      style={{ width: Math.min(b.sizePx, 24) * 0.6, height: Math.min(b.sizePx, 24) * 0.6 }}
                      aria-hidden="true"
                    />
                  </span>
                </span>
                <span className="text-xs text-foreground">
                  <span className="font-semibold">{b.range}</span>{" "}
                  <span className="text-muted-foreground">{b.label}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Beetle icon size represents cumulative count since last pheromone reset date.
        </p>
      </Panel>

      {/* Right column: selected trap + Top 10 */}
      <div className="flex flex-col gap-5">
        <Panel title="Selected Trap" icon={Bug}>
          {selectedTrap ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Trap No" value={selectedTrap.trapNo} />
              <Field label="Trap Type" value={selectedTrap.type} />
              <Field label="Last Count" value={`${selectedTrap.lastCount}`} />
              <Field label="Cumulative Since Reset" value={`${selectedTrap.cumulativeCount}`} />
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Risk Level</dt>
                <dd className="mt-1">
                  <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", riskBadge[selectedTrap.risk])}>
                    {selectedTrap.risk}
                  </span>
                </dd>
              </div>
              <Field label="Last Inspection Date" value={selectedTrap.lastInspection} />
              <Field label="Pheromone Installed On" value={resetSchedule.pheromoneInstalledOn} />
              <Field label="Pheromone Change On" value={resetSchedule.pheromoneChangeOn} />
            </dl>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Select a trap on the map to view its details.
            </p>
          )}
        </Panel>

        <Panel title="Top 10 Traps Since Last Reset" icon={Trophy}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] border-collapse text-sm">
              <thead>
                <tr className="bg-primary/10 text-left text-[11px] font-semibold uppercase tracking-wide text-primary">
                  <th className="px-2.5 py-2.5">#</th>
                  <th className="px-2.5 py-2.5">Trap No</th>
                  <th className="px-2.5 py-2.5">Type</th>
                  <th className="px-2.5 py-2.5 text-right">Cumulative</th>
                  <th className="px-2.5 py-2.5">Risk</th>
                </tr>
              </thead>
              <tbody>
                {topTraps.map((t, i) => (
                  <tr
                    key={t.trapNo}
                    onClick={() => setSelectedTrapNo(t.trapNo)}
                    className={cn(
                      "cursor-pointer border-b border-border last:border-0 hover:bg-muted/50",
                      t.trapNo === selectedTrapNo && "bg-primary/5",
                    )}
                  >
                    <td className="px-2.5 py-2.5 font-semibold text-muted-foreground">{i + 1}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 font-medium text-foreground">{t.trapNo}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-muted-foreground">{t.type}</td>
                    <td className="px-2.5 py-2.5 text-right font-semibold text-foreground">{t.cumulativeCount}</td>
                    <td className="px-2.5 py-2.5">
                      <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", riskBadge[t.risk])}>
                        {t.risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  )
}
