import { TableProperties } from "lucide-react"
import { BeetleTrapMatrixExcelExport } from "@/components/beetle/beetle-trap-matrix-excel-export"
import { Panel } from "@/components/farm/panel"
import {
  buildBeetleTrapMatrix,
  type BeetleTrapLocationRecord,
  type BeetleTrapType,
} from "@/lib/beetle-trap-matrix"
import { cn } from "@/lib/utils"

interface BeetleTrapDailyMatrixProps {
  locations: BeetleTrapLocationRecord[] | null
  dashboardDates: string[]
}

function formatDisplayDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date)
}

function trapTextClass(trapType: BeetleTrapType): string {
  if (trapType === "Red Palm Weevil") return "text-red-700"
  if (trapType === "Rhinoceros Beetle") return "text-black"
  return "text-muted-foreground"
}

export function BeetleTrapDailyMatrix({ locations, dashboardDates }: BeetleTrapDailyMatrixProps) {
  const matrix = buildBeetleTrapMatrix(locations ?? [], dashboardDates)

  return (
    <Panel
      title="Beetle in Traps"
      icon={TableProperties}
      headerRight={locations !== null && matrix.traps.length > 0 ? <BeetleTrapMatrixExcelExport matrix={matrix} /> : null}
      className="border-primary/30 bg-primary/5"
      bodyClassName="p-0 sm:p-0"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border px-4 py-3 text-sm sm:px-5">
        <span className="font-medium text-muted-foreground">Blank cells indicate zero or no recorded count. Click a date above to locate its trap-wise counts.</span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
          <span className="size-2.5 rounded-full bg-red-700" aria-hidden="true" />
          Red Palm Weevil
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-black">
          <span className="size-2.5 rounded-full bg-black" aria-hidden="true" />
          Rhinoceros Beetle
        </span>
      </div>

      {locations === null ? (
        <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5">
          Trap-wise Beetle Count records are temporarily unavailable.
        </p>
      ) : matrix.traps.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5">
          No active Beetle Traps are available yet.
        </p>
      ) : (
        <div
          className="max-w-full overflow-x-auto overscroll-x-contain"
          role="region"
          tabIndex={0}
          aria-label="Trap-wise daily Beetle Count table"
        >
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">Beetle count totals and inspection dates by trap number</caption>
            <thead>
              <tr className="bg-primary/10 text-xs font-semibold uppercase tracking-wide text-primary">
                <th scope="col" className="sticky left-0 z-20 min-w-32 border-b border-r border-primary/20 bg-[#e8f3e9] px-3 py-2.5 text-left">
                  Trap No.
                </th>
                {matrix.traps.map((trap) => (
                  <th
                    key={trap.trapNo}
                    scope="col"
                    className={cn(
                      "min-w-14 border-b border-r border-primary/20 bg-[#e8f3e9] px-2 py-2.5 text-center",
                      trapTextClass(trap.trapType),
                    )}
                    title={`Trap ${trap.trapNo}: ${trap.trapType}`}
                  >
                    {trap.trapNo}
                  </th>
                ))}
              </tr>
              <tr className="bg-primary/5 font-extrabold">
                <th scope="row" className="sticky left-0 z-20 border-b border-r border-primary/20 bg-[#f0f9f1] px-3 py-2.5 text-left text-foreground">
                  Total
                </th>
                {matrix.traps.map((trap) => (
                  <td
                    key={`total-${trap.trapNo}`}
                    className={cn(
                      "border-b border-r border-primary/20 px-2 py-2.5 text-center",
                      trapTextClass(trap.trapType),
                    )}
                  >
                    {trap.total === 0 ? null : trap.total}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr
                  id={`beetle-traps-${row.sourceDate}`}
                  key={row.sourceDate}
                  className="scroll-mt-24 odd:bg-card even:bg-muted/20 target:bg-amber-100 target:ring-2 target:ring-inset target:ring-amber-500"
                >
                  <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-border bg-inherit px-3 py-2.5 text-left font-bold text-foreground">
                    {formatDisplayDate(row.sourceDate)}
                  </th>
                  {row.counts.map((count, index) => (
                    <td
                      key={`${row.sourceDate}-${matrix.traps[index].trapNo}`}
                      className={cn(
                        "border-b border-r border-border px-2 py-2.5 text-center font-semibold",
                        trapTextClass(matrix.traps[index].trapType),
                      )}
                    >
                      {count === null || count === 0 ? null : count}
                    </td>
                  ))}
                </tr>
              ))}
              {matrix.rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={matrix.traps.length + 1}>
                    No trap-wise Beetle Count records are available yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
