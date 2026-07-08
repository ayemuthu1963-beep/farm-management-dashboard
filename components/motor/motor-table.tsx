import type { MotorDailyRecord } from "@/lib/motor-data"
import { cn } from "@/lib/utils"

interface MotorTableProps {
  records: MotorDailyRecord[]
  headerClassName?: string
}

export function MotorTable({ records, headerClassName }: MotorTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr
            className={cn(
              "text-left text-xs font-semibold uppercase tracking-wide",
              headerClassName ?? "bg-primary/10 text-primary",
            )}
          >
            <th className="px-3 py-2.5">Date</th>
            <th className="px-3 py-2.5 text-right">Run Hours</th>
            <th className="px-3 py-2.5 text-right">Starts</th>
            <th className="px-3 py-2.5 text-right">Energy (Units)</th>
            <th className="px-3 py-2.5 text-right">Water Lifted</th>
            <th className="px-3 py-2.5">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.date} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-3 py-2.5 text-foreground">{r.date}</td>
              <td className="px-3 py-2.5 text-right font-medium text-foreground">{r.runHours.toFixed(1)}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{r.starts}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{r.energyUnits.toFixed(1)}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{r.waterLifted.toFixed(1)}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{r.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
