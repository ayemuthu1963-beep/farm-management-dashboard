import { BrainCircuit } from "lucide-react"
import { AiAnalyzerClient } from "@/components/ai-analyzer/ai-analyzer-client"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"


export default function AiFarmAnalyzerPage() {
  return <DashboardShell><div className="mx-auto flex max-w-[96rem] flex-col gap-5 p-3 sm:p-5">
    <Header />
    <div className="flex items-start gap-3"><span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><BrainCircuit className="size-6" aria-hidden="true" /></span><div><h1 className="text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">AI Farm Analyzer</h1><p className="text-sm text-muted-foreground">Deterministic farm evidence with optional, constrained AI explanations</p></div></div>
    <AiAnalyzerClient />
  </div></DashboardShell>
}
