import { Leaf, Package, CalendarDays, TriangleAlert, TrendingUp, ClipboardList, Boxes, type LucideIcon } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { DateRangeSelector } from "@/components/farm/date-range-selector"
import { StatCard, StatGrid } from "@/components/farm/stat-card"
import { ExportButton } from "@/components/farm/export-button"
import { FertiliserChart } from "@/components/fertiliser/fertiliser-chart"
import {
  fertiliserSummary,
  fertiliserSchedule,
  stockItems,
  type FertiliserSummary,
  type ScheduleStatus,
  type StockLevel,
} from "@/lib/fertiliser-data"
import { cn } from "@/lib/utils"

const summaryIcon: Record<FertiliserSummary["icon"], LucideIcon> = {
  bag: Package,
  calendar: CalendarDays,
  applied: Leaf,
  alert: TriangleAlert,
}

const summaryAccent: Record<FertiliserSummary["icon"], string> = {
  applied: "bg-chart-2/15 text-chart-2",
  calendar: "bg-primary/10 text-primary",
  bag: "bg-chart-4/15 text-chart-4",
  alert: "bg-destructive/10 text-destructive",
}

const scheduleStyles: Record<ScheduleStatus, string> = {
  Done: "bg-chart-2/15 text-chart-2",
  Scheduled: "bg-primary/10 text-primary",
  Overdue: "bg-destructive/10 text-destructive",
}

const stockStyles: Record<StockLevel, string> = {
  Good: "bg-chart-2/15 text-chart-2",
  Low: "bg-chart-1/15 text-chart-1",
  Critical: "bg-destructive/10 text-destructive",
}

export default function FertiliserManagementPage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        {/* Page heading */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Leaf className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
                Fertiliser Management
              </h1>
              <p className="text-sm text-muted-foreground">Schedules, quantities applied and stock levels</p>
            </div>
          </div>
          <ExportButton />
        </div>

        {/* Summary cards */}
        <StatGrid>
          {fertiliserSummary.map((s) => (
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

        {/* Schedule + usage trend */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel
            title="Application Schedule"
            icon={ClipboardList}
            headerRight={<ExportButton label="Export" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Block</th>
                    <th className="px-3 py-2.5">Fertiliser</th>
                    <th className="px-3 py-2.5 text-right">kg</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fertiliserSchedule.map((f, i) => (
                    <tr key={`${f.date}-${i}`} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="whitespace-nowrap px-3 py-2.5 text-foreground">{f.date}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{f.block}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{f.fertiliser}</td>
                      <td className="px-3 py-2.5 text-right text-foreground">{f.quantityKg}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                            scheduleStyles[f.status],
                          )}
                        >
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Usage Trend (Last 6 Months)" icon={TrendingUp}>
            <FertiliserChart />
          </Panel>
        </div>

        {/* Stock levels */}
        <Panel
          title="Stock Levels"
          icon={Boxes}
          headerRight={<ExportButton label="Export" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                  <th className="px-3 py-2.5">Item</th>
                  <th className="px-3 py-2.5 text-right">In Stock (kg)</th>
                  <th className="px-3 py-2.5 text-right">Reorder At (kg)</th>
                  <th className="px-3 py-2.5">Level</th>
                </tr>
              </thead>
              <tbody>
                {stockItems.map((s) => (
                  <tr key={s.name} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{s.name}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{s.inStockKg.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{s.reorderKg.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                          stockStyles[s.level],
                        )}
                      >
                        {s.level}
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
