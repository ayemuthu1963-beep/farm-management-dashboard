import Link from "next/link"
import { ArrowLeft, DatabaseZap } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { HarvestManualReviewWorkspace } from "@/components/admin/harvest-manual-review-workspace"
import { PreviewAdminNotice } from "@/components/admin/preview-admin-notice"

export const dynamic = "force-dynamic"

export default function HarvestSyncAdminPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <Link href="/admin/harvest-cycle" className="inline-flex items-center gap-2 text-sm font-extrabold uppercase text-primary">
          <ArrowLeft className="size-4" />
          Back to Harvest Cycle Admin
        </Link>
        <PreviewAdminNotice />
        <section className="rounded-2xl border border-primary/15 bg-card p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-primary">Preview Harvest Admin</p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-black uppercase text-foreground">
            <DatabaseZap className="size-8" />
            Harvest Manual Review &amp; Import
          </h1>
          <p className="mt-2 max-w-4xl text-sm font-medium text-muted-foreground">
            Review ODK Harvest submissions, resolve discrepancies, run a safety dry run and manually import the approved date-specific batch.
          </p>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <p><span className="font-extrabold">Mode:</span> Manual Review &amp; Import</p>
            <p><span className="font-extrabold">Environment:</span> Preview / UAT</p>
            <p><span className="font-extrabold">Database:</span> mfms_server_uat</p>
            <p><span className="font-extrabold">ODK Project:</span> 17</p>
            <p><span className="font-extrabold">Form:</span> mfms_preview_harvest_test_v1</p>
          </div>
        </section>
        <HarvestManualReviewWorkspace />
      </div>
    </DashboardShell>
  )
}
