import { Activity, Calculator } from "lucide-react"

import { HarvestHubCard, type HarvestHubCardProps } from "@/components/coconut/harvest-hub-card"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"

const counterCards: HarvestHubCardProps[] = [
  {
    title: "Harvest Live Counter",
    description: "View ODK coconut harvest totals for a date or inclusive date range.",
    href: "/coconut-harvest/live-counter",
    icon: Activity,
    accent: "bg-primary/10 text-primary",
  },
  {
    title: "Coconut Counting",
    description: "Review date-wise coconut counts synchronized from the Coconut Counting APK.",
    href: "/coconut-counting",
    icon: Calculator,
    accent: "bg-chart-2/15 text-chart-2",
  },
]

export default function LiveHarvestCounterPage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
              Live Harvest Counter
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose a counter to view live field data from the connected APKs
            </p>
          </div>
        </div>

        <section
          aria-label="Live Harvest Counter views"
          className="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {counterCards.map((card) => (
            <HarvestHubCard key={card.title} {...card} />
          ))}
        </section>
      </div>
    </DashboardShell>
  )
}
