import Link from "next/link"
import { ChevronLeft, ScanLine } from "lucide-react"

export function AnalysisPageHeader() {
  return (
    <header className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <nav aria-label="Breadcrumb">
        <Link
          href="/motor-runtime"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Motor Runtime
        </Link>
      </nav>
      <div className="mt-3 flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ScanLine className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-balance text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
            Motor Screenshot Runtime Analysis
          </h1>
          <p className="mt-1 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Paste scanned motor notification text, upload a TXT file, or optionally upload a screenshot.
            The system identifies MOTOR/MTR records, prepares the ON/OFF pairs and calculates date-wise motor runtime.
          </p>
        </div>
      </div>
    </header>
  )
}
