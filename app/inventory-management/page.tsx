import { Boxes } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { InventoryDashboardClient } from "@/components/inventory/inventory-dashboard-client"

export default function InventoryManagementPage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Boxes className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
                Inventory Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Stock received, stock used, opening balance, expiry and live inventory balance.
              </p>
            </div>
          </div>
        </div>

        <InventoryDashboardClient />
      </div>
    </DashboardShell>
  )
}
