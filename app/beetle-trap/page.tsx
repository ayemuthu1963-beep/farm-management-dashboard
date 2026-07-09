import {
  Bug,
  Target,
  TriangleAlert,
  MapPin,
  CalendarClock,
  RefreshCw,
  CircleCheck,
  Clock,
  CalendarDays,
  type LucideIcon,
} from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { StatCard } from "@/components/farm/stat-card"
import { ExportButton } from "@/components/farm/export-button"
import { BeetleMapSection } from "@/components/beetle/beetle-map-section"
import { BeetleDailyChart } from "@/components/beetle/beetle-daily-chart"
import {
  beetleSummary,
  dailyCounts,
  areaInfections,
  resetSchedule,
  lastInspectionDate,
  nextInspectionDate,
  type BeetleSummary,
} from "@/lib/beetle-data"
import { cn } from "@/lib/utils"

const summaryIcon: Record<BeetleSummary["icon"], LucideIcon> = {
  trap: Target,
  rhino: Bug,
  weevil: Bug,
  calendar: CalendarClock,
  alert: TriangleAlert,
  area: MapPin,
}

const summaryAccent: Record<BeetleSummary["icon"], string> = {
  trap: "bg-primary/10 text-primary",
  rhino: "bg-foreground/10 text-foreground",
  weevil: "bg-destructive/10 text-destructive",
  calendar: "bg-chart-1/15 text-chart-1",
  alert: "bg-destructive/10 text-destructive",
  area: "bg-chart-3/15 text-chart-3",
}

const areaMax = Math.max(...areaInfections.map((a) => a.count))

function areaBarColor(count: number): string {
  if (count >= 60) return "bg-destructive"
  if (count >= 40) return "bg-chart-3"
  if (count >= 25) return "bg-warning"
  return "bg-chart-2"
}

export default function BeetleTrapPage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        {/* Page heading */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bug className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
                Beetle Trap Monitoring
              </h1>
              <p className="text-sm text-muted-foreground">Traps are inspected every 2 days</p>
            </div>
          </div>
          <ExportButton />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {beetleSummary.map((s) => (
            <StatCard
              key={s.label}
              icon={summaryIcon[s.icon]}
              label={s.label}
              value={s.value}
              sublabel={s.unit}
              accent={summaryAccent[s.icon]}
            />
          ))}
        </div>

        {/* Map + selected trap + top 10 */}
        <BeetleMapSection />

        {/* Daily beetle counts */}
        <Panel
          title="Daily Beetle Count – Last 15 Inspection Dates"
          icon={CalendarDays}
          headerRight={<ExportButton label="Export" />}
        >
          <BeetleDailyChart />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5 text-right">Rhinoceros Beetle Count</th>
                  <th className="px-3 py-2.5 text-right">Red Palm Weevil Count</th>
                </tr>
              </thead>
              <tbody>
                {dailyCounts.map((d) => (
                  <tr key={d.date} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{d.date}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{d.rhinoceros}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{d.redPalmWeevil}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Trap & pheromone reset schedule (shared for both trap types) */}
        <Panel title="Trap &amp; Pheromone Reset Schedule" icon={RefreshCw}>
          <p className="mb-4 text-xs text-muted-foreground">
            This schedule is the same for both trap types.
          </p>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ScheduleField label="Pheromone Installed On" value={resetSchedule.pheromoneInstalledOn} />
            <ScheduleField label="Pheromone Change On" value={resetSchedule.pheromoneChangeOn} />
            <ScheduleField label="Change Interval" value={`${resetSchedule.changeIntervalDays} days`} />
            <ScheduleField label="Cumulative Count Start Date" value={resetSchedule.cumulativeCountStartDate} />
            <ScheduleField label="Days Remaining" value={`${resetSchedule.daysRemaining} days`} highlight />
          </dl>
        </Panel>

        {/* Bottom: infection by area + recent inspection status */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel title="Beetle Infection by Area" icon={MapPin}>
            <ul className="flex flex-col gap-3">
              {areaInfections.map((a) => (
                <li key={a.area}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{a.area}</span>
                    <span className="text-muted-foreground">{a.count} beetles</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", areaBarColor(a.count))}
                      style={{ width: `${(a.count / areaMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Recent Inspection Status" icon={CircleCheck}>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-lg border border-chart-2/30 bg-chart-2/10 p-3">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-chart-2" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Last inspection completed</p>
                  <p className="text-sm text-muted-foreground">{lastInspectionDate} · all 78 traps inspected</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-chart-1/30 bg-chart-1/10 p-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-chart-1" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Next inspection due</p>
                  <p className="text-sm text-muted-foreground">
                    {nextInspectionDate} · in {resetSchedule.daysRemaining} days (every 2 days)
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Traps inspected</span>
                  <span className="text-muted-foreground">78 / 78</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-full rounded-full bg-chart-2" />
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </DashboardShell>
  )
}

function ScheduleField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border border-border p-3", highlight ? "bg-primary/5" : "bg-muted/30")}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-lg font-bold", highlight ? "text-primary" : "text-foreground")}>{value}</dd>
    </div>
  )
}
