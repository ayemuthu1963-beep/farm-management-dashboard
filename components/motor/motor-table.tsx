import type { MotorDailyRecord } from "@/lib/motor-data"

interface MotorTableProps { records: MotorDailyRecord[] }

export function MotorTable({ records }: MotorTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead>
          <tr className="bg-primary/10 text-left text-[11px] font-semibold uppercase tracking-wide text-primary">
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3">Runtime</th>
            <th className="px-3 py-3">Starts</th>
            <th className="px-3 py-3">Plot</th>
            <th className="px-3 py-3">Valve</th>
            <th className="px-3 py-3">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && (
            <tr className="border-t border-border">
              <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                No motor runtime records found for the selected period.
              </td>
            </tr>
          )}
          {records.map((record, index) => (
            <tr key={`${record.date}-${record.valve ?? "none"}-${index}`} className="border-t border-border hover:bg-muted/50">
              <td className="whitespace-nowrap px-3 py-3 text-foreground">{record.date}</td>
              <td className="px-3 py-3 text-foreground">{record.runHours.toFixed(2)} hrs</td>
              <td className="px-3 py-3 text-foreground">{record.starts}</td>
              <td className="px-3 py-3 text-muted-foreground">{record.plot ?? "--"}</td>
              <td className="px-3 py-3 text-muted-foreground">{record.valve ?? "--"}</td>
              <td className="px-3 py-3 text-muted-foreground">{record.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
