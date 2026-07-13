import { ClipboardList } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { InventoryEntryClient } from "@/components/inventory/inventory-entry-client"

export default function InventoryEntryPage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ClipboardList className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
                Inventory Entry
              </h1>
              <p className="text-sm text-muted-foreground">
                Record opening stock, stock received, stock used, returns, expiry and adjustments.
              </p>
            </div>
          </div>
        </div>

        <InventoryEntryClient />
      </div>
    </DashboardShell>
  )
}
