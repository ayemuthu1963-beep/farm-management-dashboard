import { Gauge, Power, Clock } from "lucide-react"
import { motorStatuses, type MotorStatus } from "@/lib/motor-data"
import { cn } from "@/lib/utils"

const statusStyles: Record<MotorStatus["status"], string> = {
  Running: "bg-chart-2/15 text-chart-2",
  Idle: "bg-muted text-muted-foreground",
  Maintenance: "bg-chart-1/15 text-chart-1",
}

function StatusCard({ motor }: { motor: MotorStatus }) {
  const running = motor.status === "Running"
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg",
          running ? "bg-chart-2/15 text-chart-2" : "bg-muted text-muted-foreground",
        )}
      >
        <Gauge className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-foreground">{motor.name}</p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              statusStyles[motor.status],
            )}
          >
            <Power className="size-3" aria-hidden="true" />
            {motor.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{motor.well}</p>
        <div className="mt-2 flex items-center gap-1 text-sm font-semibold text-foreground">
          <Clock className="size-4 text-primary" aria-hidden="true" />
          {motor.runHoursToday.toFixed(1)} hrs today
        </div>
        <p className="text-[11px] text-muted-foreground">Last start: {motor.lastStart}</p>
      </div>
    </div>
  )
}

export function MotorStatusCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {motorStatuses.map((motor) => (
        <StatusCard key={motor.id} motor={motor} />
      ))}
    </div>
  )
}
