import Link from "next/link"
import { ChevronRight, ArrowLeft } from "lucide-react"
import { ExportButton } from "@/components/farm/export-button"

interface CoconutSubheaderProps {
  /** Last breadcrumb segment, e.g. "Tree View" */
  breadcrumb: string
  title: string
  subtitle?: string
}

// Shared sub-page header for Coconut Harvest detail pages:
// breadcrumb (Home > Coconut Harvest > X), page title/subtitle,
// a "Back to Coconut Harvest" link and a visual-only Export button.
export function CoconutSubheader({ breadcrumb, title, subtitle }: CoconutSubheaderProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li>
            <Link href="/coconut-harvest" className="hover:text-foreground">
              Coconut Harvest
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li aria-current="page" className="font-medium text-foreground">
            {breadcrumb}
          </li>
        </ol>
      </nav>

      {/* Title + actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/coconut-harvest"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Coconut Harvest
          </Link>
          <ExportButton />
        </div>
      </div>
    </div>
  )
}
