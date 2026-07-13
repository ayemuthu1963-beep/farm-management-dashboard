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
  iconClassName?: string
  /** full storage capacity, shown to the right of the well heading */
  capacity?: string
}

export function WellSection({
  title,
  icon,
  records,
  tableHeaderClassName,
  iconClassName,
  capacity,
}: WellSectionProps) {
  return (
    <Panel
      title={title}
      icon={icon}
      iconClassName={iconClassName}
      bodyClassName="space-y-5 p-4 sm:p-5"
      headerRight={
        capacity ? (
          <span className="text-[11px] font-medium normal-case tracking-normal text-muted-foreground">
            Full Capacity
            <span className="block text-sm font-bold text-foreground">{capacity}</span>
          </span>
        ) : undefined
      }
    >
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
