import Link from "next/link"
import { ArrowLeft, Sprout } from "lucide-react"

import { TreeLifecycleAdminClient } from "@/components/admin/tree-lifecycle-admin-client"
import { PreviewAdminNotice } from "@/components/admin/preview-admin-notice"
import { DashboardShell } from "@/components/farm/dashboard-shell"

export const dynamic = "force-dynamic"

export default function TreeLifecycleAdminPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-5">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
          <ArrowLeft className="size-4" />
          Back to Admin Console
        </Link>
        <PreviewAdminNotice />
        <TreeLifecycleAdminClient />
      </div>
    </DashboardShell>
  )
}
