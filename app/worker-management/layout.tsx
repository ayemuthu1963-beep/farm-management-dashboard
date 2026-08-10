import type { ReactNode } from "react"
import { WorkerModuleShell } from "@/components/worker-management/worker-module-shell"

export default function WorkerManagementLayout({ children }: { children: ReactNode }) {
  return <WorkerModuleShell>{children}</WorkerModuleShell>
}
