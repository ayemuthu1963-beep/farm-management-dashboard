import { Sparkles } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { IntelligenceClient } from "@/components/intelligence/intelligence-client"

export default function IntelligencePage() {
  return <DashboardShell><div className="mx-auto flex max-w-5xl flex-col gap-5 p-3 sm:p-5">
    <Header />
    <div className="flex items-start gap-3"><span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles className="size-6" aria-hidden="true" /></span><div><h1 className="text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">MFMS Intelligence</h1><p className="text-sm text-muted-foreground">Governed answers from verified harvest, irrigation, well-water, and descriptive beetle-monitoring analytics</p></div></div>
    <IntelligenceClient />
  </div></DashboardShell>
}
