import { Droplets } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { valveGroups } from "@/lib/motor-data"
import { cn } from "@/lib/utils"

const remarkStyles: Record<string, string> = {
  Normal: "bg-secondary text-secondary-foreground",
  "Low pressure": "bg-chart-1/15 text-chart-1",
}

export function MotorValvesSection() {
  return (
    <Panel title="Valves Opened Time" icon={Droplets}>
      <div className="space-y-6">
        {valveGroups.map((group) => (
          <div key={group.motors}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">{group.motors}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                    <th className="px-3 py-2.5">Valve</th>
                    <th className="px-3 py-2.5">Area</th>
                    <th className="px-3 py-2.5">Opened Time</th>
                    <th className="px-3 py-2.5">Closed Time</th>
                    <th className="px-3 py-2.5">Runtime</th>
                    <th className="px-3 py-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {group.valves.map((v) => (
                    <tr key={v.valve} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{v.valve}</td>
                      <td className="px-3 py-2.5 text-foreground">{v.area}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{v.openedTime}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{v.closedTime}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{v.runtime}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                            remarkStyles[v.remarks] ?? "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {v.remarks}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
