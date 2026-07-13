import Link from "next/link"
import { ArrowRight, type LucideIcon } from "lucide-react"

export interface HarvestHubCardProps {
  title: string
  description: string
  href: string
  icon: LucideIcon
  /** Tailwind classes for the icon tile, e.g. "bg-chart-1/15 text-chart-1" */
  accent?: string
}

// Landing-page card for the Coconut Harvest hub. Mirrors the approved MFMS
// module-card visual style (white card, border, soft shadow, big icon tile,
// uppercase bold title, arrow CTA) but uses lucide icons + theme tokens.
export function HarvestHubCard({ title, description, href, icon: Icon, accent }: HarvestHubCardProps) {
  return (
    <Link
      href={href}
      className="flex min-h-[220px] flex-col gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm transition-shadow hover:shadow-md"
    >
      <span
        className={`flex size-16 items-center justify-center rounded-2xl ${accent ?? "bg-primary/10 text-primary"}`}
      >
        <Icon className="size-8" aria-hidden="true" />
      </span>
      <div className="flex flex-1 flex-col">
        <h3 className="text-lg font-extrabold uppercase leading-tight tracking-tight text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-extrabold text-primary">
          Open
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}
