import type { ZoneId } from "@/lib/irrigation-data"

export const irrigationZoneVisuals: Record<
  ZoneId,
  { background: string; border: string; chart: string }
> = {
  P1E: { background: "bg-green-50", border: "border-green-200", chart: "#22c55e" },
  P1W: { background: "bg-emerald-50", border: "border-emerald-200", chart: "#0d9488" },
  P2E: { background: "bg-blue-50", border: "border-blue-200", chart: "#3b82f6" },
  P2W: { background: "bg-purple-50", border: "border-purple-200", chart: "#a855f7" },
  JF: { background: "bg-amber-50", border: "border-amber-200", chart: "#f59e0b" },
  NM: { background: "bg-rose-50", border: "border-rose-200", chart: "#f43f5e" },
}
