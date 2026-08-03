import { Droplet, Droplets, ArrowUpFromLine, RotateCw, type LucideIcon } from "lucide-react"
import { formatNumberIN, type SummaryStat } from "@/lib/well-data"
import { cn } from "@/lib/utils"

const iconMap: Record<SummaryStat["icon"], LucideIcon> = {
  drop: Droplet,
  "drop-alt": Droplets,
  pump: ArrowUpFromLine,
  recharge: RotateCw,
}

const wellToneMap: Record<SummaryStat["wellId"], { card: string; icon: string; title: string }> = {
  north: {
    card: "border-chart-1/30 bg-chart-1/10",
    icon: "bg-chart-1/15 text-chart-1",
    title: "text-chart-1",
  },
  south: {
    card: "border-chart-3/30 bg-chart-3/10",
    icon: "bg-chart-3/15 text-chart-3",
    title: "text-chart-3",
  },
  both: {
    card: "border-chart-2/30 bg-chart-2/10",
    icon: "bg-chart-2/15 text-chart-2",
    title: "text-chart-2",
  },
}

function StatCard({ stat }: { stat: SummaryStat }) {
  const Icon = iconMap[stat.icon]
  const tone = wellToneMap[stat.wellId]
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-4 shadow-sm", tone.card)}>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone.icon)}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={cn("text-[11px] font-semibold uppercase leading-tight tracking-wide", tone.title)}>
          {stat.well}
        </p>
        <p className="text-[11px] leading-tight text-muted-foreground">{stat.label}</p>
        {stat.value === null ? (
          <>
            <p className="mt-1 text-2xl font-bold text-foreground">—</p>
            <p className="text-[11px] text-muted-foreground">{stat.warning ?? "Unavailable"}</p>
          </>
        ) : (
          <>
            <p className="mt-1 text-2xl font-bold text-foreground">{formatNumberIN(Math.round(stat.value))}</p>
            <p className="text-[11px] text-muted-foreground">Litres</p>
          </>
        )}
      </div>
    </div>
  )
}

interface SummaryCardsProps {
  stats: SummaryStat[]
}

export function SummaryCards({ stats }: SummaryCardsProps) {
  return (
    <section className="rounded-xl border border-primary/25 bg-primary/5 p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-foreground">Summary (Selected Period)</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={`${stat.wellId}-${stat.label}`} stat={stat} />
        ))}
      </div>
    </section>
  )
}
