import { cn } from "@/lib/utils"
import { formatSignedRupees } from "@/lib/worker-management"
import type { AccountStatus, AccountType, PaidStatus, SyncStatus } from "@/lib/worker-management"

export function SignedAmount({ amount, className }: { amount: number; className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold",
        amount < 0 ? "text-destructive" : amount > 0 ? "text-primary" : "text-muted-foreground",
        className,
      )}
    >
      {formatSignedRupees(amount)}
    </span>
  )
}

export const syncStatusStyles: Record<SyncStatus, string> = {
  "Saved on device": "bg-secondary text-secondary-foreground",
  "Waiting to sync": "bg-warning/25 text-warning-foreground",
  Synced: "bg-accent text-accent-foreground",
  Conflict: "bg-destructive/15 text-destructive",
}

export const syncStatusDot: Record<SyncStatus, string> = {
  "Saved on device": "bg-secondary-foreground/60",
  "Waiting to sync": "bg-warning-foreground",
  Synced: "bg-accent-foreground",
  Conflict: "bg-destructive",
}

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium",
        syncStatusStyles[status],
      )}
    >
      <span className={cn("size-1.5 rounded-full", syncStatusDot[status])} aria-hidden="true" />
      {status}
    </span>
  )
}

const legendItems: SyncStatus[] = ["Saved on device", "Waiting to sync", "Synced", "Conflict"]

export function SyncStatusLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
      aria-label="Sync status legend"
    >
      <span className="font-semibold text-foreground">Legend:</span>
      {legendItems.map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", syncStatusDot[status])} aria-hidden="true" />
          {status}
        </span>
      ))}
    </div>
  )
}

export function PaidStatusBadge({ status }: { status: PaidStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium",
        status === "Paid" ? "bg-accent text-accent-foreground" : "bg-warning/25 text-warning-foreground",
      )}
    >
      {status}
    </span>
  )
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium",
        status === "Active" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  )
}

export const accountTypeStyles: Record<AccountType, string> = {
  Farm: "bg-primary/10 text-primary",
  Outside: "bg-chart-2/15 text-chart-2",
  Group: "bg-chart-3/15 text-chart-3",
}

export function AccountTypeBadge({ type }: { type: AccountType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold",
        accountTypeStyles[type],
      )}
    >
      {type}
    </span>
  )
}
