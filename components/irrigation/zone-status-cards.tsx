"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, CircleAlert, CircleMinus, LandPlot, Leaf, LoaderCircle, Save, TreePine, Waves, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatWaterLitres, statusColors, type Zone, type ZoneId } from "@/lib/irrigation-data"
import { emptyIrrigationTargets, operatorSettingsError, type OperatorSettingsResponse } from "@/lib/operator-settings"

interface ZoneStatusCardsProps {
  zones: Zone[]
  selectedZoneId: ZoneId
  onSelectZone: (zoneId: ZoneId) => void
}

const statusIcon = { irrigated: CheckCircle2, "no-record": CircleMinus, partial: CircleAlert, issue: CircleAlert }
const DISPLAY_ZONE_ORDER: ZoneId[] = ["P1W", "P1E", "P2W", "P2E", "JF", "NM"]
const zoneAppearance: Record<ZoneId, { icon: LucideIcon; card: string; iconTile: string }> = {
  P1W: { icon: LandPlot, card: "border-chart-1/30 bg-chart-1/10", iconTile: "bg-chart-1/15 text-chart-1" },
  P1E: { icon: LandPlot, card: "border-chart-2/30 bg-chart-2/10", iconTile: "bg-chart-2/15 text-chart-2" },
  P2W: { icon: LandPlot, card: "border-chart-3/30 bg-chart-3/10", iconTile: "bg-chart-3/15 text-chart-3" },
  P2E: { icon: LandPlot, card: "border-chart-4/30 bg-chart-4/10", iconTile: "bg-chart-4/15 text-chart-4" },
  JF: { icon: TreePine, card: "border-chart-5/30 bg-chart-5/10", iconTile: "bg-chart-5/15 text-chart-5" },
  NM: { icon: Leaf, card: "border-primary/30 bg-primary/10", iconTile: "bg-primary/15 text-primary" },
}

type SaveState = "idle" | "saving" | "saved" | "error"

export function ZoneStatusCards({ zones, selectedZoneId, onSelectZone }: ZoneStatusCardsProps) {
  const [irrigationTargets, setIrrigationTargets] = useState<Record<ZoneId, string>>(emptyIrrigationTargets)
  const [isLoadingTargets, setIsLoadingTargets] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStates, setSaveStates] = useState<Record<ZoneId, SaveState>>({
    P1W: "idle",
    P1E: "idle",
    P2W: "idle",
    P2E: "idle",
    JF: "idle",
    NM: "idle",
  })
  const displayZones = [...zones].sort((left, right) => DISPLAY_ZONE_ORDER.indexOf(left.id) - DISPLAY_ZONE_ORDER.indexOf(right.id))

  useEffect(() => {
    let isActive = true

    async function loadTargets() {
      try {
        const response = await fetch("/api/operator-settings", { cache: "no-store" })
        const payload = (await response.json().catch(() => ({}))) as OperatorSettingsResponse
        if (!response.ok) throw new Error(operatorSettingsError(payload, "Irrigation Targets could not be loaded."))
        if (!isActive) return

        const loaded = emptyIrrigationTargets()
        for (const zoneId of DISPLAY_ZONE_ORDER) {
          const target = payload.irrigationTargets?.[zoneId]?.target
          loaded[zoneId] = typeof target === "string" ? target : ""
        }
        setIrrigationTargets(loaded)
        setLoadError(null)
      } catch (error) {
        if (isActive) setLoadError(error instanceof Error ? error.message : "Irrigation Targets could not be loaded.")
      } finally {
        if (isActive) setIsLoadingTargets(false)
      }
    }

    void loadTargets()
    return () => { isActive = false }
  }, [])

  function updateTarget(zoneId: ZoneId, target: string) {
    setIrrigationTargets((current) => ({ ...current, [zoneId]: target }))
    setSaveStates((current) => ({ ...current, [zoneId]: "idle" }))
  }

  async function saveTarget(zoneId: ZoneId) {
    setSaveStates((current) => ({ ...current, [zoneId]: "saving" }))
    try {
      const response = await fetch(`/api/operator-settings/irrigation-targets/${zoneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: irrigationTargets[zoneId] }),
      })
      const payload = (await response.json().catch(() => ({}))) as OperatorSettingsResponse & { ok?: boolean; target?: unknown }
      if (!response.ok || payload.ok !== true) {
        throw new Error(operatorSettingsError(payload, `${zoneId} Irrigation Target could not be saved.`))
      }
      setIrrigationTargets((current) => ({ ...current, [zoneId]: typeof payload.target === "string" ? payload.target : current[zoneId] }))
      setSaveStates((current) => ({ ...current, [zoneId]: "saved" }))
    } catch {
      setSaveStates((current) => ({ ...current, [zoneId]: "error" }))
    }
  }

  const targetsDisabled = isLoadingTargets || Boolean(loadError)

  return (
    <div>
      {loadError ? <p className="mb-2 text-xs font-semibold text-destructive">{loadError} Refresh the page to try again.</p> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {displayZones.map((zone) => {
        const Icon = statusIcon[zone.status]
        const palette = statusColors[zone.status]
        const appearance = zoneAppearance[zone.id]
        const ZoneIcon = appearance.icon
        const selected = selectedZoneId === zone.id

        return (
          <div
            key={zone.id}
            className={cn(
              "overflow-hidden rounded-xl border text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
              appearance.card,
              selected ? "border-primary ring-2 ring-primary/20" : null,
            )}
          >
            <button
              type="button"
              onClick={() => onSelectZone(zone.id)}
              aria-pressed={selected}
              className="w-full p-4 pb-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", appearance.iconTile)}>
                    <ZoneIcon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="font-bold text-foreground">{zone.name}</div>
                    <div className="text-xs text-muted-foreground">{zone.crop}</div>
                  </div>
                </div>
                <span className={cn("rounded-full border p-2", palette.bg, palette.border, palette.text)} title={zone.statusLabel}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              </div>

              <div className="mt-4 space-y-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn("font-semibold", palette.text)}>{zone.statusLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Runtime</span>
                  <span className="font-medium text-foreground">{zone.valveOpenTime}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Water</span>
                  <span className="font-medium text-foreground">{formatWaterLitres(zone.totalWaterSupplied)}</span>
                </div>
              </div>
            </button>

            <div className="mx-4 border-t border-foreground/10 py-2">
              <div className="flex items-center gap-1.5 text-sm">
                <label htmlFor={`${zone.id}-irrigation-target`} className="shrink-0 text-muted-foreground">Irrigation Target</label>
                <input
                  id={`${zone.id}-irrigation-target`}
                  type="text"
                  maxLength={120}
                  value={irrigationTargets[zone.id]}
                  placeholder="****************"
                  aria-label={`${zone.name} irrigation target`}
                  disabled={targetsDisabled}
                  onChange={(event) => updateTarget(zone.id, event.target.value)}
                  className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-right font-mono font-semibold text-foreground outline-none transition placeholder:text-foreground hover:border-input focus:border-ring focus:bg-background/80 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => { void saveTarget(zone.id) }}
                  disabled={targetsDisabled || saveStates[zone.id] === "saving"}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-input bg-background/90 px-2 text-[11px] font-bold text-foreground shadow-sm transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saveStates[zone.id] === "saving" ? <LoaderCircle className="size-3 animate-spin" aria-hidden="true" /> : <Save className="size-3" aria-hidden="true" />}
                  Save
                </button>
              </div>
              {saveStates[zone.id] === "saved" ? (
                <span className="mt-1 flex items-center justify-end gap-1 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 className="size-3" aria-hidden="true" /> Saved
                </span>
              ) : null}
              {saveStates[zone.id] === "error" ? <p className="mt-1 text-right text-[10px] font-semibold text-destructive">Could not save</p> : null}
            </div>

            {zone.id === "NM" ? (
              <div className="mx-4 mb-4 mt-2 inline-flex items-center gap-1 rounded-full bg-fuchsia-50 px-2 py-1 text-[11px] font-semibold text-fuchsia-700">
                <Waves className="size-3" aria-hidden="true" /> Overlay: Plot 1 East + Plot 2 West
              </div>
            ) : null}
          </div>
        )
        })}
      </div>
    </div>
  )
}
