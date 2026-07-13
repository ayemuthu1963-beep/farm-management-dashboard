import { Sprout, Trees, CalendarRange, Trophy, Search } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { HarvestHubCard, type HarvestHubCardProps } from "@/components/coconut/harvest-hub-card"

const hubCards: HarvestHubCardProps[] = [
  {
    title: "Tree View",
    description: "Select a tree and view its full harvest history cycle by cycle.",
    href: "/coconut-harvest/tree-view",
    icon: Trees,
    accent: "bg-chart-2/15 text-chart-2",
  },
  {
    title: "Cycle & Harvest View",
    description: "Summaries by harvest cycle and custom date range.",
    href: "/coconut-harvest/cycle-view",
    icon: CalendarRange,
    accent: "bg-chart-3/15 text-chart-3",
  },
  {
    title: "Tree Performance View",
    description: "Plot 1 and Plot 2 trees classified by yield over the last 10 cycles.",
    href: "/coconut-harvest/tree-performance",
    icon: Trophy,
    accent: "bg-chart-1/15 text-chart-1",
  },
  {
    title: "Detailed Query",
    description: "Apply multiple filters to search harvests, trees and sales.",
    href: "/coconut-harvest/detailed-query",
    icon: Search,
    accent: "bg-chart-4/15 text-chart-4",
  },
]

export default function CoconutHarvestPage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        {/* Page heading */}
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sprout className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
              Coconut Harvest
            </h1>
            <p className="text-sm text-muted-foreground">Choose a view to explore harvest data</p>
          </div>
        </div>

        {/* 4 hub cards */}
        <section aria-label="Coconut Harvest views" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {hubCards.map((card) => (
            <HarvestHubCard key={card.title} {...card} />
          ))}
        </section>
      </div>
    </DashboardShell>
  )
}
