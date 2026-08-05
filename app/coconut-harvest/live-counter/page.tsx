import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { CoconutSubheader } from "@/components/coconut/coconut-subheader"
import { LiveCounterClient } from "@/components/coconut/live-counter-client"

export default function HarvestLiveCounterPage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <CoconutSubheader
          breadcrumb="Live Harvest Monitor"
          title="Harvest Live Counter"
          subtitle="View ODK harvest totals by date or inclusive date range."
        />
        <LiveCounterClient />
      </div>
    </DashboardShell>
  )
}
