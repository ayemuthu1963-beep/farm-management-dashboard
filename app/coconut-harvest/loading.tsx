import { Sprout } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { HarvestRequestState } from "@/components/coconut/harvest-request-state"

export default function CoconutHarvestLoading() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sprout className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
              Coconut Harvest
            </h1>
            <p className="text-sm text-muted-foreground">Preparing harvest view</p>
          </div>
        </div>
        <HarvestRequestState tone="loading" message="Loading harvest data..." />
      </div>
    </DashboardShell>
  )
}
