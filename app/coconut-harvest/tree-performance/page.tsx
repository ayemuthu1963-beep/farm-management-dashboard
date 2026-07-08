import { Trophy } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { CoconutSubheader } from "@/components/coconut/coconut-subheader"
import { plot1Performance, plot2Performance, performanceCyclesUsed, type PerformanceRow } from "@/lib/coconut-harvest-data"

function PerformanceTable({ rows }: { rows: PerformanceRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
            <th className="px-3 py-2.5">Rank</th>
            <th className="px-3 py-2.5">Category</th>
            <th className="px-3 py-2.5">Criteria</th>
            <th className="px-3 py-2.5 text-right">Tree Count</th>
            <th className="px-3 py-2.5 text-right">Min Nuts</th>
            <th className="px-3 py-2.5 text-right">Max Nuts</th>
            <th className="px-3 py-2.5 text-right">Average Nuts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.rank}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
            >
              <td className="px-3 py-2.5 font-medium text-muted-foreground">{r.rank}</td>
              <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-foreground">{r.category}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{r.criteria}</td>
              <td className="px-3 py-2.5 text-right text-foreground">{r.treeCount.toLocaleString("en-IN")}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{r.minNuts}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{r.maxNuts}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-foreground">{r.averageNuts.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TreePerformancePage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <CoconutSubheader breadcrumb="Tree Performance View" title="Plot 1 and Plot 2 Performance" />

        <p className="text-sm text-muted-foreground">
          Last 10 cycles used: <span className="font-medium text-foreground">{performanceCyclesUsed.join(", ")}</span>
        </p>

        <Panel title="Plot 1: Tree numbers 1 to 999" icon={Trophy}>
          <PerformanceTable rows={plot1Performance} />
        </Panel>

        <Panel title="Plot 2: Tree numbers above 1000" icon={Trophy}>
          <PerformanceTable rows={plot2Performance} />
        </Panel>
      </div>
    </DashboardShell>
  )
}
