import { Clock, Power, RotateCw, Droplet, type LucideIcon } from "lucide-react"
import { motorSummaryStats, type MotorSummaryStat } from "@/lib/motor-data"
import { cn } from "@/lib/utils"

const iconMap: Record<MotorSummaryStat["icon"], LucideIcon> = {
  clock: Clock,
  power: Power,
  starts: RotateCw,
  water: Droplet,
}

const accentMap: Record<MotorSummaryStat["icon"], string> = {
  clock: "bg-chart-1/15 text-chart-1",
  power: "bg-chart-4/15 text-chart-4",
  starts: "bg-chart-3/15 text-chart-3",
  water: "bg-chart-2/15 text-chart-2",
}

function StatCard({ stat }: { stat: MotorSummaryStat }) {
  const Icon = iconMap[stat.icon]
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", accentMap[stat.icon])}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-primary">{stat.motor}</p>
        <p className="text-[11px] leading-tight text-muted-foreground">{stat.label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{stat.value.toFixed(stat.unit === "Cycles" ? 0 : 1)}</p>
        <p className="text-[11px] text-muted-foreground">{stat.unit}</p>
      </div>
    </div>
  )
}

export function MotorSummaryCards() {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-foreground">Summary (Selected Period)</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {motorSummaryStats.map((stat) => (
          <StatCard key={`${stat.motorId}-${stat.label}`} stat={stat} />
        ))}
      </div>
    </section>
  )
}
