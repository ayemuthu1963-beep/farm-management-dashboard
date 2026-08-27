import type { ReactNode } from "react"
import type { Metadata } from "next"
import { WorkerModuleShell } from "@/components/worker-management/worker-module-shell"

export const metadata: Metadata = {
  title: "MFMS-Worker Management",
  description: "Offline-capable daily wage, settlement, and worker loan management.",
  manifest: "/worker-management.webmanifest",
  icons: {
    icon: "/muthu-farms-logo.png",
    apple: "/muthu-farms-logo.png",
  },
  appleWebApp: {
    capable: true,
    title: "Worker Management",
    statusBarStyle: "default",
  },
}

export default function WorkerManagementLayout({ children }: { children: ReactNode }) {
  return <WorkerModuleShell>{children}</WorkerModuleShell>
}
