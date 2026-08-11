"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { WorkerManagementProvider } from "@/components/worker-management/worker-management-context"
import { DashboardSection } from "@/components/worker-management/sections/dashboard-section"
import { WageEntrySection } from "@/components/worker-management/sections/wage-entry-section"
import { DirectorySection } from "@/components/worker-management/sections/directory-section"
import { SettlementSection } from "@/components/worker-management/sections/settlement-section"
import { LoanRegisterSection } from "@/components/worker-management/sections/loan-register-section"
import { RegistersSection } from "@/components/worker-management/sections/registers-section"
import { navItems, type WorkerSection } from "@/lib/worker-management"

function WorkerManagementWorkspace() {
  const [section, setSection] = useState<WorkerSection>("Dashboard")

  const content = useMemo(() => {
    switch (section) {
      case "Dashboard":
        return <DashboardSection />
      case "Daily Wage Entry":
        return <WageEntrySection />
      case "Worker Directory":
        return <DirectorySection />
      case "Weekly Settlement":
        return <SettlementSection />
      case "Loan Register":
        return <LoanRegisterSection />
      case "Registers & History":
        return <RegistersSection />
      default:
        return null
    }
  }, [section])

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-5 sm:px-6">
          <Link
            href="/"
            className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
            aria-label="Back to farm home"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          <div>
            <p className="font-serif text-xl font-bold">Worker Management</p>
            <p className="text-xs text-muted-foreground">Local Phase 1 workspace · seeded data</p>
          </div>
        </div>
        <nav
          aria-label="Worker management sections"
          className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6"
        >
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSection(item)}
              aria-current={section === item ? "page" : undefined}
              className={
                section === item
                  ? "whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                  : "whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              }
            >
              {item}
            </button>
          ))}
        </nav>
      </div>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{content}</main>
    </div>
  )
}

export function WorkerManagementClient() {
  return (
    <DashboardShell>
      <WorkerManagementProvider>
        <WorkerManagementWorkspace />
      </WorkerManagementProvider>
    </DashboardShell>
  )
}
