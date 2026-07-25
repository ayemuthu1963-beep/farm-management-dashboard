import Link from "next/link"
import { ArrowLeft, Gauge } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Panel } from "@/components/farm/panel"
import { MotorRuntimeEntryClient } from "@/components/admin/motor-runtime-entry-client"

export default function AdminMotorRuntimePage() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-5">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
          <ArrowLeft className="size-4" />
          Back to Admin Console
        </Link>
        <Panel title="Motor Runtime Entry" icon={Gauge}>
          <MotorRuntimeEntryClient />
        </Panel>
      </div>
    </DashboardShell>
  )
}
