import { Waves, CircleCheck, Droplet, Ruler, MapPin, TriangleAlert, type LucideIcon } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { DateRangeSelector } from "@/components/farm/date-range-selector"
import { StatCard, StatGrid } from "@/components/farm/stat-card"
import { ExportButton } from "@/components/farm/export-button"
import {
  pipelineSummary,
  pipelineSegments,
  pipelineIssues,
  type PipelineSummary,
  type SegmentStatus,
  type IssueSeverity,
} from "@/lib/pipeline-data"
import { cn } from "@/lib/utils"

const summaryIcon: Record<PipelineSummary["icon"], LucideIcon> = {
  pipe: Waves,
  ok: CircleCheck,
  leak: Droplet,
  length: Ruler,
}

const summaryAccent: Record<PipelineSummary["icon"], string> = {
  pipe: "bg-primary/10 text-primary",
  ok: "bg-chart-2/15 text-chart-2",
  leak: "bg-destructive/10 text-destructive",
  length: "bg-chart-4/15 text-chart-4",
}

const statusStyles: Record<SegmentStatus, string> = {
  Healthy: "bg-chart-2/15 text-chart-2",
  Monitor: "bg-chart-1/15 text-chart-1",
  Leak: "bg-destructive/10 text-destructive",
}

const severityStyles: Record<IssueSeverity, string> = {
  Low: "bg-chart-2/15 text-chart-2",
  Medium: "bg-chart-1/15 text-chart-1",
  High: "bg-destructive/10 text-destructive",
}

export default function PipelineLayoutPage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        {/* Page heading */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Waves className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
                Pipeline Layout & Inspection
              </h1>
              <p className="text-sm text-muted-foreground">Irrigation network status and leak tracking</p>
            </div>
          </div>
          <ExportButton />
        </div>

        {/* Summary cards */}
        <StatGrid>
          {pipelineSummary.map((s) => (
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

        {/* Segments table */}
        <Panel
          title="Pipeline Segments"
          icon={MapPin}
          headerRight={<ExportButton label="Export" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                  <th className="px-3 py-2.5">Segment</th>
                  <th className="px-3 py-2.5">Route</th>
                  <th className="px-3 py-2.5">Material</th>
                  <th className="px-3 py-2.5 text-right">Length (m)</th>
                  <th className="px-3 py-2.5">Last Inspected</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {pipelineSegments.map((p) => (
                  <tr key={p.segmentId} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{p.segmentId}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{p.route}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{p.material}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{p.lengthM}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{p.lastInspected}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                          statusStyles[p.status],
                        )}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Issues log */}
        <Panel
          title="Inspection Issues"
          icon={TriangleAlert}
          iconClassName="text-destructive"
          headerRight={<ExportButton label="Export" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                  <th className="px-3 py-2.5">Segment</th>
                  <th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5">Issue</th>
                  <th className="px-3 py-2.5">Reported</th>
                  <th className="px-3 py-2.5">Severity</th>
                </tr>
              </thead>
              <tbody>
                {pipelineIssues.map((issue, i) => (
                  <tr key={`${issue.segmentId}-${i}`} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{issue.segmentId}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{issue.location}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{issue.issue}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{issue.reported}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                          severityStyles[issue.severity],
                        )}
                      >
                        {issue.severity}
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
