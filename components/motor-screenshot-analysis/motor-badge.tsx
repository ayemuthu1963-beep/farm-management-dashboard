import { cn } from "@/lib/utils"
import { getFallbackMotor } from "@/lib/motor-screenshot-analysis-config"
import type { MotorId } from "@/lib/motor-screenshot-analysis-types"

export function MotorBadge({
  motorId,
  name,
  className,
}: {
  motorId: MotorId
  name?: string
  className?: string
}) {
  const motor = getFallbackMotor(motorId)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        motor.badgeClass,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", motor.dotClass)} aria-hidden="true" />
      {name ?? motor.name}
    </span>
  )
}
