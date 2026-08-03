import { Gauge, Power, Clock } from "lucide-react"
import type { MotorStatus } from "@/lib/motor-data"
import { cn } from "@/lib/utils"
import { Zap } from "lucide-react"

const statusStyles: Record<MotorStatus["status"], string> = {
  Running: "bg-chart-2/15 text-chart-2",
  Idle: "bg-muted text-muted-foreground",
  Maintenance: "bg-chart-1/15 text-chart-1",
}

const motorCardStyles: Record<MotorStatus["id"], { card: string; icon: string; accent: string; bar: string }> = {
  M1: { card: "border-sky-200/80 bg-sky-50/75", icon: "bg-sky-500/15 text-sky-700", accent: "text-sky-700", bar: "bg-sky-500" },
  M2: { card: "border-amber-200/80 bg-amber-50/75", icon: "bg-amber-500/15 text-amber-700", accent: "text-amber-700", bar: "bg-amber-500" },
  M3: { card: "border-emerald-200/80 bg-emerald-50/75", icon: "bg-emerald-500/15 text-emerald-700", accent: "text-emerald-700", bar: "bg-emerald-500" },
}

function StatusCard({ motor }: { motor: MotorStatus }) {
  const running = motor.status === "Running"
  const styles = motorCardStyles[motor.id]
  return (
    <div className={cn("relative overflow-hidden rounded-xl border p-4 shadow-sm", styles.card)}>
      <div className={cn("absolute inset-x-0 top-0 h-1", styles.bar)} />
      <div className="flex items-start gap-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", running ? "bg-chart-2/15 text-chart-2" : styles.icon)}>
          {running ? <Zap className="size-6" aria-hidden="true" /> : <Gauge className="size-6" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("truncate text-sm font-extrabold", styles.accent)}>{motor.name}</p>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", statusStyles[motor.status])}>
              <Power className="size-3" aria-hidden="true" />
              {motor.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{motor.well}</p>
          <div className="mt-2 flex items-center gap-1 text-sm font-semibold text-foreground">
            <Clock className={cn("size-4", styles.accent)} aria-hidden="true" />
            {motor.runHoursToday.toFixed(2)} hrs selected range
          </div>
          <p className="text-[11px] text-muted-foreground">Latest entry: {motor.lastStart}</p>
        </div>
      </div>
    </div>
  )
}

export function MotorStatusCards({ motors }: { motors: MotorStatus[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {motors.map((motor) => <StatusCard key={motor.id} motor={motor} />)}
    </div>
  )
}
