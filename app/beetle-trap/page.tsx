import { Bug, Target, TriangleAlert, CircleCheck, MapPin, TrendingUp, type LucideIcon } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { DateRangeSelector } from "@/components/farm/date-range-selector"
import { StatCard, StatGrid } from "@/components/farm/stat-card"
import { ExportButton } from "@/components/farm/export-button"
import { BeetleChart } from "@/components/beetle/beetle-chart"
import { beetleSummary, trapRecords, type BeetleSummary, type TrapStatus } from "@/lib/beetle-data"
import { cn } from "@/lib/utils"

const summaryIcon: Record<BeetleSummary["icon"], LucideIcon> = {
  bug: Bug,
  trap: Target,
  alert: TriangleAlert,
  check: CircleCheck,
}

const summaryAccent: Record<BeetleSummary["icon"], string> = {
  trap: "bg-chart-2/15 text-chart-2",
  bug: "bg-chart-1/15 text-chart-1",
  alert: "bg-destructive/10 text-destructive",
  check: "bg-primary/10 text-primary",
}

const statusStyles: Record<TrapStatus, string> = {
  Normal: "bg-chart-2/15 text-chart-2",
  High: "bg-chart-1/15 text-chart-1",
  Alert: "bg-destructive/10 text-destructive",
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
              <p className="text-sm text-muted-foreground">Pheromone trap catches and pest alerts</p>
            </div>
          </div>
          <ExportButton />
        </div>

        {/* Summary cards */}
        <StatGrid>
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
        </StatGrid>

        {/* Date range */}
        <DateRangeSelector />

        {/* Trap status + trend chart */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel
            title="Trap Status"
            icon={MapPin}
            headerRight={<ExportButton label="Export" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                    <th className="px-3 py-2.5">Trap</th>
                    <th className="px-3 py-2.5">Location</th>
                    <th className="px-3 py-2.5">Beetle Type</th>
                    <th className="px-3 py-2.5 text-right">Catches</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trapRecords.map((t) => (
                    <tr key={t.trapId} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{t.trapId}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{t.location}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{t.beetleType}</td>
                      <td className="px-3 py-2.5 text-right text-foreground">{t.catches}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                            statusStyles[t.status],
                          )}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Catch Trend (Last 6 Weeks)" icon={TrendingUp}>
            <BeetleChart />
          </Panel>
        </div>

        {/* Service log */}
        <Panel
          title="Trap Service Log"
          icon={CircleCheck}
          headerRight={<ExportButton label="Export" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                  <th className="px-3 py-2.5">Trap</th>
                  <th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5">Beetle Type</th>
                  <th className="px-3 py-2.5">Last Serviced</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {trapRecords.map((t) => (
                  <tr key={`svc-${t.trapId}`} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{t.trapId}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{t.location}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{t.beetleType}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{t.lastServiced}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                          statusStyles[t.status],
                        )}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </DashboardShell>
  )
}
