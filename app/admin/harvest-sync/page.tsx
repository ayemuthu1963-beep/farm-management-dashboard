import Link from "next/link"
import { ArrowLeft, DatabaseZap } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { HarvestSyncAdminClient } from "@/components/admin/harvest-sync-admin-client"
import { PreviewAdminNotice } from "@/components/admin/preview-admin-notice"

export const dynamic = "force-dynamic"

export default function HarvestSyncAdminPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-extrabold uppercase text-primary">
          <ArrowLeft className="size-4" />
          Back to Admin Console
        </Link>
        <PreviewAdminNotice />
        <section className="rounded-2xl border border-primary/15 bg-card p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-primary">Preview Harvest Admin</p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-black uppercase text-foreground">
            <DatabaseZap className="size-8" />
            Harvest ODK Sync
          </h1>
          <p className="mt-2 max-w-4xl text-sm font-medium text-muted-foreground">
            Admin-controlled Project 17 workflow: scan first, review issues, then import approved rows into the Preview Coconut Harvest cycle.
          </p>
        </section>
        <HarvestSyncAdminClient />
      </div>
    </DashboardShell>
  )
}
