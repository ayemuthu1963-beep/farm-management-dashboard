import type { Motor, MotorId } from "./motor-screenshot-analysis-types"

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
