import { Citrus, Trees, Scale, TrendingUp, ClipboardList, type LucideIcon } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { DateRangeSelector } from "@/components/farm/date-range-selector"
import { StatCard, StatGrid } from "@/components/farm/stat-card"
import { ExportButton } from "@/components/farm/export-button"
import { JackfruitChart } from "@/components/jackfruit/jackfruit-chart"
import { jackfruitSummary, jackfruitTrees, type JackfruitSummary, type RipenessStage } from "@/lib/jackfruit-data"
import { cn } from "@/lib/utils"

const summaryIcon: Record<JackfruitSummary["icon"], LucideIcon> = {
  fruit: Citrus,
  trees: Trees,
  ripe: Citrus,
  scale: Scale,
}

const summaryAccent: Record<JackfruitSummary["icon"], string> = {
  fruit: "bg-chart-2/15 text-chart-2",
  trees: "bg-primary/10 text-primary",
  ripe: "bg-chart-1/15 text-chart-1",
  scale: "bg-chart-4/15 text-chart-4",
}

const stageStyles: Record<RipenessStage, string> = {
  Young: "bg-chart-2/15 text-chart-2",
  Growing: "bg-primary/10 text-primary",
  Mature: "bg-chart-1/15 text-chart-1",
  Ripe: "bg-chart-3/15 text-chart-3",
}

export default function JackfruitMonitoringPage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        {/* Page heading */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Citrus className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
                Jackfruit Monitoring
              </h1>
              <p className="text-sm text-muted-foreground">Growth stages, ripeness and yield estimates</p>
            </div>
          </div>
          <ExportButton />
        </div>

        {/* Summary cards */}
        <StatGrid>
          {jackfruitSummary.map((s) => (
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

        {/* Tree monitoring + stage distribution */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel
            title="Tree Monitoring"
            icon={ClipboardList}
            headerRight={<ExportButton label="Export" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                    <th className="px-3 py-2.5">Tree</th>
                    <th className="px-3 py-2.5">Block</th>
                    <th className="px-3 py-2.5 text-right">Fruits</th>
                    <th className="px-3 py-2.5 text-right">Est. kg</th>
                    <th className="px-3 py-2.5">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {jackfruitTrees.map((t) => (
                    <tr key={t.treeId} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{t.treeId}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{t.block}</td>
                      <td className="px-3 py-2.5 text-right text-foreground">{t.fruitCount}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{t.estWeightKg}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                            stageStyles[t.stage],
                          )}
                        >
                          {t.stage}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Ripeness Distribution" icon={TrendingUp}>
            <JackfruitChart />
          </Panel>
        </div>
      </div>
    </DashboardShell>
  )
}
