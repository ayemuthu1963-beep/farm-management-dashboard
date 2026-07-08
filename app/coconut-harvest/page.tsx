import { Sprout, Nut, Trees, Scale, RotateCw, ClipboardList, TrendingUp, type LucideIcon } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { DateRangeSelector } from "@/components/farm/date-range-selector"
import { StatCard, StatGrid } from "@/components/farm/stat-card"
import { ExportButton } from "@/components/farm/export-button"
import { CoconutChart } from "@/components/coconut/coconut-chart"
import {
  coconutSummary,
  harvestCycles,
  treePerformance,
  recentHarvest,
  type CoconutSummary,
  type TreePerformance,
} from "@/lib/coconut-data"
import { cn } from "@/lib/utils"

const summaryIcon: Record<CoconutSummary["icon"], LucideIcon> = {
  nut: Nut,
  trees: Trees,
  scale: Scale,
  cycle: RotateCw,
}

const summaryAccent: Record<CoconutSummary["icon"], string> = {
  nut: "bg-chart-1/15 text-chart-1",
  trees: "bg-chart-2/15 text-chart-2",
  scale: "bg-chart-4/15 text-chart-4",
  cycle: "bg-chart-3/15 text-chart-3",
}

const statusStyles: Record<TreePerformance["status"], string> = {
  Excellent: "bg-chart-2/15 text-chart-2",
  Good: "bg-primary/10 text-primary",
  Average: "bg-chart-1/15 text-chart-1",
  Low: "bg-destructive/10 text-destructive",
}

const gradeStyles: Record<string, string> = {
  A: "bg-chart-2/15 text-chart-2",
  B: "bg-chart-1/15 text-chart-1",
}

export default function CoconutHarvestPage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        {/* Page heading */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sprout className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
                Coconut Harvest
              </h1>
              <p className="text-sm text-muted-foreground">Yields, cycles and tree performance</p>
            </div>
          </div>
          <ExportButton />
        </div>

        {/* Summary cards */}
        <StatGrid>
          {coconutSummary.map((s) => (
            <StatCard
              key={s.label}
              icon={summaryIcon[s.icon]}
              label={s.label}
              value={s.value}
              sublabel={s.sublabel}
              accent={summaryAccent[s.icon]}
            />
          ))}
        </StatGrid>

        {/* Date range */}
        <DateRangeSelector />

        {/* Cycle summary + trend chart */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel title="Cycle Summary" icon={RotateCw}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                    <th className="px-3 py-2.5">Cycle</th>
                    <th className="px-3 py-2.5">Date Range</th>
                    <th className="px-3 py-2.5 text-right">Nuts</th>
                    <th className="px-3 py-2.5 text-right">Avg / Palm</th>
                    <th className="px-3 py-2.5">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {harvestCycles.map((c) => (
                    <tr key={c.cycle} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{c.cycle}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{c.dateRange}</td>
                      <td className="px-3 py-2.5 text-right text-foreground">{c.nuts.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{c.avgPerPalm.toFixed(1)}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                            gradeStyles[c.grade] ?? "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {c.grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Harvest Trend (Last 5 Cycles)" icon={TrendingUp}>
            <CoconutChart />
          </Panel>
        </div>

        {/* Tree performance summary */}
        <Panel title="Tree Performance Summary" icon={Trees}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                  <th className="px-3 py-2.5">Block</th>
                  <th className="px-3 py-2.5 text-right">Palms</th>
                  <th className="px-3 py-2.5 text-right">Nuts</th>
                  <th className="px-3 py-2.5 text-right">Avg / Palm</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {treePerformance.map((t) => (
                  <tr key={t.block} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{t.block}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{t.palms}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{t.nuts.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{t.avgPerPalm.toFixed(1)}</td>
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

        {/* Recent harvest table */}
        <Panel
          title="Recent Harvest"
          icon={ClipboardList}
          headerRight={<ExportButton label="Export" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Block</th>
                  <th className="px-3 py-2.5 text-right">Nuts</th>
                  <th className="px-3 py-2.5 text-right">Weight (kg)</th>
                  <th className="px-3 py-2.5">Grade</th>
                  <th className="px-3 py-2.5">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {recentHarvest.map((r, i) => (
                  <tr key={`${r.date}-${i}`} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="whitespace-nowrap px-3 py-2.5 text-foreground">{r.date}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{r.block}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{r.nuts.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{r.weightKg.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                          gradeStyles[r.grade] ?? "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {r.grade}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.remarks}</td>
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
