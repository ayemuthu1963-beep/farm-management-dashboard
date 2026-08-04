import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RunStatus } from "@/lib/motor-screenshot-analysis-types"

export function StatusBadge({ status }: { status: RunStatus }) {
  const complete = status === "complete"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        complete
          ? "bg-primary/10 text-primary"
          : "bg-destructive/10 text-destructive",
      )}
    >
      {complete ? (
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
      ) : (
        <AlertTriangle className="size-3.5" aria-hidden="true" />
      )}
      {complete ? "Complete" : "Unmatched"}
    </span>
  )
}
