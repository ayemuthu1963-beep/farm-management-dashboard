import type { Motor, MotorId } from "./motor-screenshot-analysis-types"

export const SCREENSHOT_OCR_ENABLED = false

export const MOTOR_TEXT_SAMPLE = `30/07/2026 09:14:10 | MOTOR ON BECAUSE OF RTC ON TIME
30/07/2026 09:35:00 | MOTOR OFF BECAUSE OF RTC PROGRAM
30/07/2026 11:36:39 | MOTOR ON BECAUSE OF RTC ON TIME
30/07/2026 12:35:00 | MOTOR OFF BECAUSE OF RTC PROGRAM
30/07/2026 13:36:39 | MOTOR ON BECAUSE OF RTC ON TIME
30/07/2026 14:35:00 | MOTOR OFF BECAUSE OF RTC PROGRAM
30/07/2026 15:12:25 | MTRON,samsung SM-G965F
30/07/2026 15:14:04 | MOTOR ON III PHASE
30/07/2026 15:34:53 | MTROF,samsung SM-G965F
30/07/2026 15:34:53 | MOTOR OFF III PHASE
30/07/2026 16:35:00 | MOTOR OFF BECAUSE OF RTC PROGRAM`

const STYLES: Record<MotorId, Pick<Motor, "badgeClass" | "dotClass" | "accentTextClass">> = {
  "motor-1": {
    badgeClass: "bg-[color-mix(in_oklab,var(--chart-1)_16%,transparent)] text-[var(--chart-1)]",
    dotClass: "bg-[var(--chart-1)]",
    accentTextClass: "text-[var(--chart-1)]",
  },
  "motor-2": {
    badgeClass: "bg-[color-mix(in_oklab,var(--chart-2)_16%,transparent)] text-[var(--chart-2)]",
    dotClass: "bg-[var(--chart-2)]",
    accentTextClass: "text-[var(--chart-2)]",
  },
  "motor-3": {
    badgeClass: "bg-[color-mix(in_oklab,var(--chart-3)_18%,transparent)] text-[var(--chart-3)]",
    dotClass: "bg-[var(--chart-3)]",
    accentTextClass: "text-[var(--chart-3)]",
  },
}

export const FALLBACK_MOTORS: Motor[] = (["motor-1", "motor-2", "motor-3"] as MotorId[]).map(
  (id, index) => ({ id, name: `Motor ${index + 1}`, displayOrder: index + 1, ...STYLES[id] }),
)

export function motorFromApi(value: { id: string; name: string; display_order: number }): Motor {
  const id = value.id as MotorId
  return { id, name: value.name, displayOrder: value.display_order, ...STYLES[id] }
}

export function getMotorStyle(id: MotorId) {
  return STYLES[id]
}

export function getFallbackMotor(id: MotorId): Motor {
  return FALLBACK_MOTORS.find((motor) => motor.id === id) ?? FALLBACK_MOTORS[0]
}
