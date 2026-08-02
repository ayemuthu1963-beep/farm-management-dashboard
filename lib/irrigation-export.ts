import type { IrrigationData } from "@/lib/irrigation-data"

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll("\"", "\"\"")}"`
}

export function buildIrrigationZoneCsv(data: IrrigationData): string {
  const rows = [
    ["Zone", "Crop", "Motor / Valve Mapping", "Runtime", "Water Supplied (L)", "Water per Tree (L)", "Records", "Status"],
    ...data.zones.map((zone) => [
      zone.name,
      zone.crop,
      zone.motor,
      zone.valveOpenTime,
      zone.totalWaterSupplied,
      zone.waterPerTree,
      zone.recordsCount,
      zone.statusLabel,
    ]),
  ]
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
}
