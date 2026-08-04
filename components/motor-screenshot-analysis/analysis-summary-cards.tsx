import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clock,
  Images,
  Sigma,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { MotorSummary } from "@/lib/motor-screenshot-analysis-types"
import { formatRuntime } from "@/lib/motor-screenshot-analysis-format"

interface Props {
  periodLabel: string
  motorSummaries: MotorSummary[]
  combinedMinutes: number
  screenshotsProcessed: number
  completeRuns: number
  unmatched: number
}
function Tile({
  label,
  value,
  icon,
  tone = "default",
  sub,
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone?: "default" | "primary" | "warning"
  sub?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        tone === "warning"
          ? "border-destructive/40 bg-destructive/5"
          : tone === "primary"
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            tone === "warning"
              ? "text-destructive"
              : tone === "primary"
                ? "text-primary"
                : "text-muted-foreground",
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "mt-2 font-serif text-xl font-bold",
          tone === "warning" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function AnalysisSummaryCards({
  periodLabel,
  motorSummaries,
  combinedMinutes,
  screenshotsProcessed,
  completeRuns,
  unmatched,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Tile
        label="Selected Period"
        value={periodLabel}
        sub="Confirmed database records"
        icon={<CalendarRange className="size-4" aria-hidden="true" />}
      />
      {motorSummaries.map((s) => (
        <Tile
          key={s.motor.id}
          label={`${s.motor.name} Runtime`}
          value={formatRuntime(s.totalMinutes)}
          sub={`${s.completeRuns} complete runs`}
          icon={<Clock className="size-4" aria-hidden="true" />}
        />
      ))}
      <Tile
        label="Combined Runtime"
        value={formatRuntime(combinedMinutes)}
        tone="primary"
        icon={<Sigma className="size-4" aria-hidden="true" />}
      />
      <Tile
        label="Screenshots Processed"
        value={String(screenshotsProcessed)}
        icon={<Images className="size-4" aria-hidden="true" />}
      />
      <Tile
        label="Complete Runs"
        value={String(completeRuns)}
        icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
      />
      <Tile
        label="Unmatched Records"
        value={String(unmatched)}
        tone={unmatched > 0 ? "warning" : "default"}
        sub="Excluded from totals"
        icon={<AlertTriangle className="size-4" aria-hidden="true" />}
      />
    </div>
  )
}
