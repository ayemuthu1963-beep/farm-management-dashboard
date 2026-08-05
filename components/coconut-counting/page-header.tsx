import Link from "next/link"
import { Calculator, ChevronRight } from "lucide-react"

export function CoconutCountingPageHeader() {
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li aria-current="page" className="font-medium text-foreground">
            Coconut Counting
          </li>
        </ol>
      </nav>

      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Calculator className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
            Coconut Counting
          </h1>
          <p className="text-sm text-muted-foreground">
            Harvest counts synchronized from the local-first Coconut Counting APK
          </p>
        </div>
      </div>
    </div>
  )
}
