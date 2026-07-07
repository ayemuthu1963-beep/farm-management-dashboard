import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface PanelProps {
  title: ReactNode
  icon?: LucideIcon
  iconClassName?: string
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function Panel({ title, icon: Icon, iconClassName, children, className, bodyClassName }: PanelProps) {
  return (
    <section className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
        {Icon ? <Icon className={cn("size-5 text-primary", iconClassName)} aria-hidden="true" /> : null}
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground sm:text-base">{title}</h2>
      </div>
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  )
}
