"use client"

import { CheckCircle2, CircleAlert, CircleMinus, LandPlot, Leaf, TreePine, Waves, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatWaterLitres, statusColors, type Zone, type ZoneId } from "@/lib/irrigation-data"

interface ZoneStatusCardsProps { zones: Zone[]; selectedZoneId: ZoneId; onSelectZone: (zoneId: ZoneId) => void }
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

export function ZoneStatusCards({ zones, selectedZoneId, onSelectZone }: ZoneStatusCardsProps) {
  const displayZones = [...zones].sort((left, right) => DISPLAY_ZONE_ORDER.indexOf(left.id) - DISPLAY_ZONE_ORDER.indexOf(right.id))
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{displayZones.map((zone) => {
    const Icon = statusIcon[zone.status]
    const palette = statusColors[zone.status]
    const ZoneIcon = zoneAppearance[zone.id].icon
    const appearance = zoneAppearance[zone.id]
    const selected = selectedZoneId === zone.id
    return <button key={zone.id} type="button" onClick={() => onSelectZone(zone.id)} aria-pressed={selected} className={cn("rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50", appearance.card, selected ? "border-primary ring-2 ring-primary/20" : null)}>
      <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2.5"><span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", appearance.iconTile)}><ZoneIcon className="size-5" aria-hidden="true" /></span><div><div className="font-bold text-foreground">{zone.name}</div><div className="text-xs text-muted-foreground">{zone.crop}</div></div></div><span className={cn("rounded-full border p-2", palette.bg, palette.border, palette.text)} title={zone.statusLabel}><Icon className="size-4" aria-hidden="true" /></span></div>
      <div className="mt-4 space-y-1 text-sm"><div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Status</span><span className={cn("font-semibold", palette.text)}>{zone.statusLabel}</span></div><div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Runtime</span><span className="font-medium text-foreground">{zone.valveOpenTime}</span></div><div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Water</span><span className="font-medium text-foreground">{formatWaterLitres(zone.totalWaterSupplied)}</span></div></div>
      {zone.id === "NM" ? <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-fuchsia-50 px-2 py-1 text-[11px] font-semibold text-fuchsia-700"><Waves className="size-3" aria-hidden="true" /> Overlay: Plot 1 East + Plot 2 West</div> : null}
    </button>
  })}</div>
}
