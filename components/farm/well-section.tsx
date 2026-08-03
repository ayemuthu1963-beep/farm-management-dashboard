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
  panelClassName?: string
  /** full storage capacity, shown to the right of the well heading */
  capacity?: string
}

export function WellSection({
  title,
  icon,
  records,
  tableHeaderClassName,
  iconClassName,
  panelClassName,
  capacity,
}: WellSectionProps) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Panel
        title={title}
        icon={icon}
        iconClassName={iconClassName}
        className={panelClassName ? `min-w-0 ${panelClassName}` : "min-w-0"}
        bodyClassName="min-w-0"
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
      </Panel>

      <Panel
        title={`${title} Water Trend`}
        icon={icon}
        iconClassName={iconClassName}
        className={panelClassName ? `min-w-0 ${panelClassName}` : "min-w-0"}
        bodyClassName="min-w-0"
      >
        <WellChart data={toChartData(records)} />
      </Panel>
    </div>
  )
}
