import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { MotorRuntimeManagementClient } from "@/components/admin/motor-runtime-management-client"
import { PreviewAdminNotice } from "@/components/admin/preview-admin-notice"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"

export const dynamic = "force-dynamic"

export default function AdminMotorRuntimePage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
          <ArrowLeft className="size-4" />
          Back to Admin Console
        </Link>
        <PreviewAdminNotice />
        <MotorRuntimeManagementClient />
      </div>
    </DashboardShell>
  )
}
