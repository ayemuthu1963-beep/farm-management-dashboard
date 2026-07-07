import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { farmModules } from "@/lib/farm-modules"

function ModuleCard({ module }: { module: (typeof farmModules)[number] }) {
  const inner = (
    <>
      <div className={cn("flex size-16 items-center justify-center rounded-xl", module.tint)}>
        <Image
          src={module.icon}
          alt=""
          width={56}
          height={56}
          className="size-12 object-contain"
        />
      </div>
      <div className="mt-3 min-w-0">
        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">{module.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{module.description}</p>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary">
        {module.available ? (
          <>
            Open <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </>
        ) : (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Coming soon
          </span>
        )}
      </div>
    </>
  )

  const cardClass =
    "group flex h-full flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"

  if (module.available) {
    return (
      <Link href={module.href} className={cn(cardClass, "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
        {inner}
      </Link>
    )
  }

  return (
    <div className={cn(cardClass, "cursor-default opacity-90")} aria-disabled="true">
      {inner}
    </div>
  )
}

export function ModuleGrid() {
  return (
    <section aria-label="Farm modules">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Farm Modules</h2>
        <span className="text-xs text-muted-foreground">{farmModules.length} modules &middot; more added regularly</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {farmModules.map((m) => (
          <ModuleCard key={m.title} module={m} />
        ))}

        {/* Placeholder to signal room for future modules */}
        <div className="flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plus className="size-5" aria-hidden="true" />
          </span>
          <p className="text-xs font-medium text-muted-foreground">More modules coming soon</p>
        </div>
      </div>
    </section>
  )
}
