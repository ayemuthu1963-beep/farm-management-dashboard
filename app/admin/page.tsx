import Link from "next/link"
import { Bug, Calculator, CalendarRange, DatabaseZap, Droplets, Gauge, ShieldCheck, Sprout } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Panel } from "@/components/farm/panel"
import { getPreviewDatabaseLabel, getPreviewEnvironmentLabel } from "@/components/admin/preview-admin-notice"

export const dynamic = "force-dynamic"

const adminTiles = [
  {
    title: "Coconut Counting Admin Edit",
    description: "Amend synchronized Coconut Counting session or entry values with a complete before/after audit trail.",
    href: "/admin/coconut-counting",
    icon: Calculator,
  },
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
    description: "Open, close and maintain Harvest Cycles, dates, sale details and Cycle totals.",
    href: "/admin/harvest-cycle",
    icon: CalendarRange,
  },
  {
    title: "Harvest Manual Review & Import",
    description: "Scan ODK, resolve duplicate or invalid submissions, run a dry run and manually import the reviewed Harvest batch.",
    href: "/admin/harvest-sync",
    icon: DatabaseZap,
  },
  {
    title: "Tree Lifecycle / Saplings",
    description: "Record replacement palms, manage early-bearing trees, and review all Future Better saplings with months since planting.",
    href: "/admin/tree-lifecycle",
    icon: Sprout,
  },
]

export default function AdminConsolePage() {
  const environmentLabel = getPreviewEnvironmentLabel()
  const databaseLabel = getPreviewDatabaseLabel()

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-primary/15 bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-primary">{environmentLabel}</p>
              <h1 className="mt-2 text-3xl font-black uppercase text-foreground">Admin Console</h1>
              <p className="mt-2 max-w-3xl text-sm font-medium text-muted-foreground">
                Preview administration hub. Entries made here are restricted to the UAT database and must not be used for Production data.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-chart-2/25 bg-chart-2/10 px-4 py-3 text-sm font-extrabold text-chart-2">
              <ShieldCheck className="size-5" />
              Database: {databaseLabel}
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
