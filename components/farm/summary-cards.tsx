import { Droplet, Droplets, ArrowUpFromLine, RotateCw, type LucideIcon } from "lucide-react"
import { formatNumberIN, type SummaryStat } from "@/lib/well-data"
import { cn } from "@/lib/utils"

const iconMap: Record<SummaryStat["icon"], LucideIcon> = {
  drop: Droplet,
  "drop-alt": Droplets,
  pump: ArrowUpFromLine,
  recharge: RotateCw,
}

// Distinct accent per metric type to match the design's colored icon tiles.
const accentMap: Record<SummaryStat["icon"], string> = {
  drop: "bg-chart-2/15 text-chart-2",
  "drop-alt": "bg-chart-2/15 text-chart-2",
  pump: "bg-chart-1/15 text-chart-1",
  recharge: "bg-chart-4/15 text-chart-4",
}

function StatCard({ stat }: { stat: SummaryStat }) {
  const Icon = iconMap[stat.icon]
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", accentMap[stat.icon])}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-primary">{stat.well}</p>
        <p className="text-[11px] leading-tight text-muted-foreground">{stat.label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{formatNumberIN(Math.round(stat.value))}</p>
        <p className="text-[11px] text-muted-foreground">Litres</p>
      </div>
    </div>
  )
}

interface SummaryCardsProps {
  stats: SummaryStat[]
}

export function SummaryCards({ stats }: SummaryCardsProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-foreground">Summary (Selected Period)</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {stats.map((stat) => (
          <StatCard key={`${stat.wellId}-${stat.label}`} stat={stat} />
        ))}
      </div>
    </section>
  )
}
