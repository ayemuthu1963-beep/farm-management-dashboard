import { cn } from "@/lib/utils"
import { getMotor } from "@/lib/motor-screenshot-analysis-mock-data"
import type { MotorId } from "@/lib/motor-screenshot-analysis-types"

export function MotorBadge({
  motorId,
  className,
}: {
  motorId: MotorId
  className?: string
}) {
  const motor = getMotor(motorId)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        motor.badgeClass,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", motor.dotClass)} aria-hidden="true" />
      {motor.name}
    </span>
  )
}
