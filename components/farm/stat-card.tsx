import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  sublabel?: string
  /** Tailwind classes for the icon tile, e.g. "bg-chart-1/15 text-chart-1" */
  accent?: string
}

export function StatCard({ icon: Icon, label, value, sublabel, accent }: StatCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          accent ?? "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        {sublabel ? <p className="text-[11px] text-muted-foreground">{sublabel}</p> : null}
      </div>
    </div>
  )
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
}
