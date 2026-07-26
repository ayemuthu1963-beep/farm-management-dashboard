import Link from "next/link"
import { Bug, CalendarRange, DatabaseZap, Droplets, Gauge, PackageCheck, ShieldCheck } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Panel } from "@/components/farm/panel"

const adminTiles = [
  {
    title: "Motor Runtime Entry",
    description: "Add pump runtime records for local testing and irrigation calculation checks.",
    href: "/admin/motor-runtime",
    icon: Gauge,
  },
  {
    title: "Well Water Entry",
    description: "Add manual well readings and confirm local well dashboard updates.",
    href: "/admin/well-water",
    icon: Droplets,
  },
  {
    title: "Beetle Trap Entry",
    description: "Add local trap count readings and confirm marker/count updates.",
    href: "/admin/beetle-trap",
    icon: Bug,
  },
  {
    title: "Harvest Cycle Admin",
    description: "Open and maintain Preview harvest cycles with database-write validation.",
    href: "/admin/harvest-cycle",
    icon: CalendarRange,
  },
  {
    title: "Harvest ODK Sync",
    description: "Scan Project 17, review duplicate/unmatched entries and import approved Harvest records.",
    href: "/admin/harvest-sync",
    icon: DatabaseZap,
  },
  {
    title: "Fertiliser & Pesticide Inventory Entry",
    description: "Open the inventory entry workflow for receipts, usage and adjustments.",
    href: "/inventory-management/entry",
    icon: PackageCheck,
  },
]

export default function AdminConsolePage() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-primary/15 bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-primary">LOCAL TEST</p>
              <h1 className="mt-2 text-3xl font-black uppercase text-foreground">Admin Console</h1>
              <p className="mt-2 max-w-3xl text-sm font-medium text-muted-foreground">
                Local entry hub for MFMS RC testing. Entries made here are intended for the local database only.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-chart-2/25 bg-chart-2/10 px-4 py-3 text-sm font-extrabold text-chart-2">
              <ShieldCheck className="size-5" />
              Database: mfms_local_test
            </div>
          </div>
        </section>

        <Panel title="Operational Entry Pages" icon={ShieldCheck}>
          <div className="grid gap-4 md:grid-cols-2">
            {adminTiles.map((tile) => {
              const Icon = tile.icon
              return (
                <Link
                  key={tile.href}
                  href={tile.href}
                  className="group rounded-2xl border border-border bg-background p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                      <Icon className="size-7" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase text-foreground group-hover:text-primary">{tile.title}</h2>
                      <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">{tile.description}</p>
                      <span className="mt-4 inline-flex rounded-lg bg-primary px-3 py-2 text-xs font-extrabold uppercase text-primary-foreground">
                        Open Entry
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </Panel>
      </div>
    </DashboardShell>
  )
}
