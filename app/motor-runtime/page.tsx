import { Gauge, Info, TrendingUp } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { DateRangeSelector } from "@/components/farm/date-range-selector"
import { MotorStatusCards } from "@/components/motor/motor-status-cards"
import { MotorLogSection } from "@/components/motor/motor-log-section"
import { MotorChart } from "@/components/motor/motor-chart"
import { MotorValvesSection } from "@/components/motor/motor-valves-section"
import { MotorSummaryCards } from "@/components/motor/motor-summary-cards"

export default function MotorRuntimePage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        {/* Page heading */}
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Gauge className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
              Motor Runtime
            </h1>
            <p className="text-sm text-muted-foreground">Pump run hours, energy use and performance</p>
          </div>
        </div>

        {/* Live status */}
        <MotorStatusCards />

        {/* Date range (full width) */}
        <DateRangeSelector />

        {/* Daily log + runtime trend */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <MotorLogSection />
          <Panel title="Runtime Trend (Last 5 Days)" icon={TrendingUp}>
            <MotorChart />
          </Panel>
        </div>

        {/* Valves opened / closed log */}
        <MotorValvesSection />

        {/* Summary */}
        <MotorSummaryCards />

        {/* Footer note */}
        <div className="flex items-center gap-2 rounded-xl border border-chart-1/30 bg-chart-1/10 px-4 py-3 text-sm text-foreground">
          <Info className="size-4 shrink-0 text-chart-1" aria-hidden="true" />
          <span>Energy units are indicative meter readings. Actual billing may vary by tariff slab.</span>
        </div>
      </div>
    </DashboardShell>
  )
}
