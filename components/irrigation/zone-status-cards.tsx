"use client"

import { CheckCircle2, CircleAlert, CircleMinus, Waves } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatWaterLitres, statusColors, type Zone, type ZoneId } from "@/lib/irrigation-data"

interface ZoneStatusCardsProps { zones: Zone[]; selectedZoneId: ZoneId; onSelectZone: (zoneId: ZoneId) => void }
const statusIcon = { irrigated: CheckCircle2, "no-record": CircleMinus, partial: CircleAlert, issue: CircleAlert }

export function ZoneStatusCards({ zones, selectedZoneId, onSelectZone }: ZoneStatusCardsProps) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{zones.map((zone) => {
    const Icon = statusIcon[zone.status]
    const palette = statusColors[zone.status]
    const selected = selectedZoneId === zone.id
    return <button key={zone.id} type="button" onClick={() => onSelectZone(zone.id)} aria-pressed={selected} className={cn("rounded-xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50", selected ? "border-primary ring-2 ring-primary/20" : "border-border")}>
      <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{zone.abbr}</div><div className="mt-1 font-bold text-foreground">{zone.name}</div><div className="text-xs text-muted-foreground">{zone.crop}</div></div><span className={cn("rounded-full border p-2", palette.bg, palette.border, palette.text)}><Icon className="size-4" aria-hidden="true" /></span></div>
      <div className="mt-4 space-y-1 text-sm"><div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Status</span><span className={cn("font-semibold", palette.text)}>{zone.statusLabel}</span></div><div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Runtime</span><span className="font-medium text-foreground">{zone.valveOpenTime}</span></div><div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Water</span><span className="font-medium text-foreground">{formatWaterLitres(zone.totalWaterSupplied)}</span></div></div>
      {zone.id === "NM" ? <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-fuchsia-50 px-2 py-1 text-[11px] font-semibold text-fuchsia-700"><Waves className="size-3" aria-hidden="true" /> Overlay: P1E + P2W</div> : null}
    </button>
  })}</div>
}
