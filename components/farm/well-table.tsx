import { formatNumberIN, type WellDailyRecord } from "@/lib/well-data"
import { cn } from "@/lib/utils"

interface WellTableProps {
  records: WellDailyRecord[]
  headerClassName?: string
}

const columns = [
  { key: "morningWater", label: "Morning Water", unit: "(Litres)" },
  { key: "eveningWater", label: "Evening Water", unit: "(Litres)" },
  { key: "waterPumpedOut", label: "Water Pumped Out", unit: "(Litres)" },
] as const

function formatLitres(value: number | null): string {
  if (value === null) return "—"
  return formatNumberIN(Math.round(value))
}

export function WellTable({ records, headerClassName }: WellTableProps) {
  return (
    <div className="max-w-full min-w-0 overflow-x-auto">
      <table className="w-full min-w-[560px] table-fixed border-collapse text-sm">
        <thead>
          <tr className={cn("text-left text-[11px] font-semibold uppercase tracking-wide", headerClassName)}>
            <th className="px-3 py-3">Date</th>
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-3">
                {col.label}
                <span className="block text-[10px] font-normal normal-case opacity-80">{col.unit}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && (
            <tr className="border-t border-border">
              <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                No well water readings found for the selected period.
              </td>
            </tr>
          )}
          {records.map((record) => (
            <tr key={record.date} className="border-t border-border hover:bg-muted/50">
              <td className="whitespace-nowrap px-3 py-3 text-foreground">{record.date}</td>
              <td className="px-3 py-3 text-foreground">{record.morningWaterDisplay}</td>
              <td className="px-3 py-3 text-foreground">{record.eveningWaterDisplay}</td>
              <td className="px-3 py-3 text-foreground">
                {record.knownZeroReason ? (
                  <div>
                    <div className="font-semibold">0</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">Not run: {record.knownZeroReason}</div>
                  </div>
                ) : record.isPlaceholder ? "" : formatLitres(record.waterPumpedOut)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
