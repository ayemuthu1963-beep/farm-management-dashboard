import { ArrowRight, ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RunRecord } from "@/lib/motor-screenshot-analysis-types"
import { formatDate, formatRuntime, formatTime } from "@/lib/motor-screenshot-analysis-format"
import { MotorBadge } from "./motor-badge"
import { StatusBadge } from "./status-badge"

export function RuntimeRecordCard({
  record,
  onViewScreenshot,
  showDate = true,
}: {
  record: RunRecord
  onViewScreenshot: (record: RunRecord) => void
  showDate?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MotorBadge motorId={record.motorId} name={record.motorName} />
          <span className="text-xs text-muted-foreground">Run {record.run}</span>
        </div>
        <StatusBadge status={record.status} />
      </div>

      {showDate && (
        <p className="mt-2 text-xs text-muted-foreground">{formatDate(record.date)}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Motor ON</p>
          <p className="font-medium text-foreground">{formatTime(record.onTime)}</p>
          <p className="text-xs text-muted-foreground">{record.onReason ?? "\u2014"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Motor OFF</p>
          <p className="font-medium text-foreground">{formatTime(record.offTime)}</p>
          <p className="text-xs text-muted-foreground">{record.offReason ?? "\u2014"}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <div>
          <p className="text-xs text-muted-foreground">Runtime</p>
          <p
            className={cn(
              "font-serif text-base font-bold",
              record.status !== "complete" ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {record.status !== "complete" ? "\u2014" : formatRuntime(record.runtimeMinutes)}
          </p>
        </div>
        <button
          type="button"
          disabled={!record.screenshotId}
          onClick={() => onViewScreenshot(record)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
        >
          <ImageIcon className="size-3.5" aria-hidden="true" />
          {record.sourceType === "screenshot" ? "View Screenshot" : "Text import"}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
