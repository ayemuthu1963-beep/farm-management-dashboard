import type { LucideIcon } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { WellTable } from "@/components/farm/well-table"
import { WellChart } from "@/components/farm/well-chart"
import { toChartData, type WellDailyRecord } from "@/lib/well-data"

interface WellSectionProps {
  title: string
  icon: LucideIcon
  records: WellDailyRecord[]
  tableHeaderClassName?: string
}

export function WellSection({ title, icon, records, tableHeaderClassName }: WellSectionProps) {
  return (
    <Panel title={title} icon={icon} bodyClassName="space-y-5 p-4 sm:p-5">
      <WellTable records={records} headerClassName={tableHeaderClassName} />
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground">
          {title} - Water Trend <span className="font-normal text-muted-foreground">(Last 5 Days)</span>
        </h3>
        <WellChart data={toChartData(records)} />
      </div>
    </Panel>
  )
}
