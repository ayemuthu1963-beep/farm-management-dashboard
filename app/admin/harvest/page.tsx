import Link from "next/link"
import { ArrowLeft, Sprout } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Panel } from "@/components/farm/panel"
import { HarvestEntryClient } from "@/components/admin/harvest-entry-client"

export default function AdminHarvestPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-5">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
          <ArrowLeft className="size-4" />
          Back to Admin Console
        </Link>
        <Panel title="Harvest Data Entry" icon={Sprout}>
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-primary">
              LOCAL TEST — DO NOT USE FOR PRODUCTION DATA
            </p>
            <h1 className="mt-3 text-2xl font-black uppercase text-foreground">Harvest Data Entry</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-muted-foreground">
              Local manual entry for coconut harvest testing.
            </p>
          </div>

          <div className="mt-5">
            <HarvestEntryClient />
          </div>
        </Panel>
      </div>
    </DashboardShell>
  )
}
