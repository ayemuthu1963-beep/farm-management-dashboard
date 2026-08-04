import { Clock, RadioTower, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { MotorSummary } from "@/lib/motor-screenshot-analysis-types"
import { formatRuntime, formatTime } from "@/lib/motor-screenshot-analysis-format"

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}
export function MotorSummaryCard({
  summary,
  onViewRecords,
}: {
  summary: MotorSummary
  onViewRecords?: (motorId: MotorSummary["motor"]["id"]) => void
}) {
  const { motor } = summary
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("size-2.5 rounded-full", motor.dotClass)} aria-hidden="true" />
          <h3 className="font-serif text-base font-bold text-foreground">{motor.name}</h3>
        </div>
        {summary.unmatched > 0 && (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            {summary.unmatched} unmatched
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Clock className={cn("size-5", motor.accentTextClass)} aria-hidden="true" />
        <span className="font-serif text-2xl font-bold text-foreground">
          {formatRuntime(summary.totalMinutes)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Confirmed runtime</p>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Complete runs" value={String(summary.completeRuns)} />
        <Stat label="First run" value={formatTime(summary.firstRunTime)} />
        <Stat label="Last run" value={formatTime(summary.lastRunTime)} />
        <Stat label="Unmatched" value={String(summary.unmatched)} />
      </dl>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-foreground">
          <RadioTower className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {summary.rtcOperations} RTC
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-foreground">
          <Smartphone className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {summary.phoneOperations} Phone
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={() => onViewRecords?.(motor.id)}
      >
        View Motor Records
      </Button>
    </div>
  )
}
