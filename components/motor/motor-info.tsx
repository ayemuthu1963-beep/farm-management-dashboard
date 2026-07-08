import { Info } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { motorInfo } from "@/lib/motor-data"
import { cn } from "@/lib/utils"

export function MotorInfo() {
  return (
    <Panel title="Motor Information" icon={Info}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
              <th className="px-3 py-2.5">Motor</th>
              <th className="px-3 py-2.5">Power</th>
              <th className="px-3 py-2.5">Connection No</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {motorInfo.map((motor) => (
              <tr key={motor.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5 font-medium text-foreground">{motor.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{motor.power}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{motor.connectionNo}</td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <span className={cn("size-2.5 rounded-full", motor.statusColor)} aria-hidden="true" />
                    {motor.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
