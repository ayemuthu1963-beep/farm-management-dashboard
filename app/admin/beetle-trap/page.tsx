import Link from "next/link"
import { ArrowLeft, Bug } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Panel } from "@/components/farm/panel"
import { BeetleTrapEntryClient } from "@/components/admin/beetle-trap-entry-client"
import { PreviewAdminNotice } from "@/components/admin/preview-admin-notice"

export const dynamic = "force-dynamic"

export default function AdminBeetleTrapPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-5">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
          <ArrowLeft className="size-4" />
          Back to Admin Console
        </Link>
        <PreviewAdminNotice />
        <Panel title="Beetle Trap Entry" icon={Bug}>
          <BeetleTrapEntryClient />
        </Panel>
      </div>
    </DashboardShell>
  )
}
