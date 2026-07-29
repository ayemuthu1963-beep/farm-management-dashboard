import { Droplets } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import type { ValveGroup } from "@/lib/motor-data"

export function MotorValvesSection({ valveGroups }: { valveGroups: ValveGroup[] }) {
  return (
    <Panel title="Valve Runtime History" icon={Droplets}>
      <div className="space-y-6">
        {valveGroups.every((group) => group.valves.length === 0) && <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No valve runtime records found for the selected period.</p>}
        {valveGroups.map((group) => group.valves.length > 0 ? (
          <div key={group.motors}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">{group.motors}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Motor No.</th>
                    <th className="px-3 py-2.5">Valve</th>
                    <th className="px-3 py-2.5">Area</th>
                    <th className="px-3 py-2.5">Runtime</th>
                    <th className="px-3 py-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {group.valves.map((v, index) => (
                    <tr key={`${v.date}-${v.motorNo}-${v.valve}-${v.area}-${index}`} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{v.date}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-foreground">{v.motorNo}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-foreground">{v.valve}</td>
                      <td className="px-3 py-2.5 text-foreground">{v.area}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{v.runtime}</td>
                      <td className="max-w-[320px] px-3 py-2.5 text-muted-foreground">{v.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null)}
      </div>
    </Panel>
  )
}
