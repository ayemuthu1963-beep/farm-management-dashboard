import { Info } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { wellInfo } from "@/lib/well-data"
import { cn } from "@/lib/utils"

export function WellMotorInfo() {
  return (
    <Panel title="Well & Motor Information" icon={Info} bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="bg-secondary text-left text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
              <th className="px-4 py-3">Well</th>
              <th className="px-4 py-3">
                Full Capacity
                <span className="block text-[10px] font-normal normal-case text-muted-foreground">(Lacs Litres)</span>
              </th>
              <th className="px-4 py-3">Motor</th>
              <th className="px-4 py-3">Connection No</th>
            </tr>
          </thead>
          <tbody>
            {wellInfo.map((well) =>
              well.motors.map((motor, motorIndex) => (
                <tr key={`${well.id}-${motor.connectionNo}`} className="border-t border-border">
                  {motorIndex === 0 ? (
                    <>
                      <td className="px-4 py-3 align-middle" rowSpan={well.motors.length}>
                        <span className="flex items-center gap-2 font-medium text-foreground">
                          <span className={cn("size-3 rounded-full", well.statusColor)} aria-hidden="true" />
                          {well.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle text-foreground" rowSpan={well.motors.length}>
                        {well.fullCapacity.toFixed(2)}
                      </td>
                    </>
                  ) : null}
                  <td className="px-4 py-3 text-foreground">{motor.label}</td>
                  <td className="px-4 py-3 text-foreground">{motor.connectionNo}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
