import { AlertTriangle, FileSearch, LoaderCircle } from "lucide-react"

type StateTone = "loading" | "empty" | "error"

const toneClass: Record<StateTone, string> = {
  loading: "border-primary/20 bg-primary/5 text-primary",
  empty: "border-chart-4/30 bg-chart-4/10 text-chart-4",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
}

const iconClass: Record<StateTone, string> = {
  loading: "text-primary",
  empty: "text-chart-4",
  error: "text-destructive",
}

interface HarvestRequestStateProps {
  tone: StateTone
  message: string
  detail?: string
  compact?: boolean
  onRetry?: () => void
  retryLabel?: string
}

export function HarvestRequestState({
  tone,
  message,
  detail,
  compact = false,
  onRetry,
  retryLabel = "Retry",
}: HarvestRequestStateProps) {
  const Icon = tone === "loading" ? LoaderCircle : tone === "empty" ? FileSearch : AlertTriangle

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg border ${toneClass[tone]} ${compact ? "px-3 py-2" : "px-4 py-6 text-center"}`}
    >
      <div className={`flex ${compact ? "items-center" : "flex-col items-center"} gap-3`}>
        <Icon
          className={`${compact ? "size-4" : "size-6"} ${iconClass[tone]} ${tone === "loading" ? "motion-safe:animate-spin" : ""}`}
          aria-hidden="true"
        />
        <div className={compact ? "min-w-0" : ""}>
          <p className={`${compact ? "text-xs" : "text-sm"} font-semibold`}>{message}</p>
          {detail ? <p className={`${compact ? "text-xs" : "mt-1 text-sm"} opacity-80`}>{detail}</p> : null}
        </div>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center justify-center rounded-lg border border-destructive/30 bg-card px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}

export function HarvestButtonSpinner() {
  return <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
}
