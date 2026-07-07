import type { WellDailyRecord } from "@/lib/well-data"
import { cn } from "@/lib/utils"

interface WellTableProps {
  records: WellDailyRecord[]
  headerClassName?: string
}

const columns = [
  { key: "morningWater", label: "Morning Water", unit: "(Lacs Litres)" },
  { key: "eveningWater", label: "Evening Water", unit: "(Lacs Litres)" },
  { key: "waterPumpedOut", label: "Water Pumped Out", unit: "(Lacs Litres)" },
  { key: "rechargedSinceYesterday", label: "Recharged Since Yesterday", unit: "(Lacs Litres)" },
] as const

const remarkStyles: Record<string, string> = {
  Normal: "bg-secondary text-secondary-foreground",
  "Slight Rain": "bg-chart-1/15 text-chart-1",
  "Light Rain": "bg-chart-1/15 text-chart-1",
}

export function WellTable({ records, headerClassName }: WellTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className={cn("text-left text-[11px] font-semibold uppercase tracking-wide", headerClassName)}>
            <th className="px-3 py-3">Date</th>
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-3">
                {col.label}
                <span className="block text-[10px] font-normal normal-case opacity-80">{col.unit}</span>
              </th>
            ))}
            <th className="px-3 py-3">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.date} className="border-t border-border hover:bg-muted/50">
              <td className="whitespace-nowrap px-3 py-3 text-foreground">
                {record.date}
                <span className="block text-[10px] text-muted-foreground">({record.relativeLabel})</span>
              </td>
              <td className="px-3 py-3 text-foreground">{record.morningWater.toFixed(2)}</td>
              <td className="px-3 py-3 text-foreground">{record.eveningWater.toFixed(2)}</td>
              <td className="px-3 py-3 text-foreground">{record.waterPumpedOut.toFixed(2)}</td>
              <td className="px-3 py-3 text-foreground">{record.rechargedSinceYesterday.toFixed(2)}</td>
              <td className="px-3 py-3">
                <span
                  className={cn(
                    "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                    remarkStyles[record.remarks] ?? "bg-secondary text-secondary-foreground",
                  )}
                >
                  {record.remarks}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
