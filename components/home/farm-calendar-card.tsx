import { ExternalLink } from "lucide-react"
import { homepageNavigationItems } from "@/lib/mfms-navigation"

const calendarNavigation = homepageNavigationItems.find((item) => item.id === "farm-calendar")!
const CalendarIcon = calendarNavigation.icon

export function FarmCalendarCard() {
  return (
    <a
      href={calendarNavigation.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open Farm Calendar in a new tab"
      className="flex min-h-[280px] gap-5 rounded-xl border border-[#dce9dc] bg-white/95 p-6 text-[#071f13] shadow-[0_8px_22px_rgba(0,0,0,0.09)] transition-shadow hover:shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
    >
      <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#e5f3e2] text-[#0a7a37] sm:size-24">
        <CalendarIcon className="size-12" aria-hidden="true" />
      </span>

      <span className="flex flex-1 flex-col">
        <h3 className="text-xl font-extrabold uppercase leading-tight text-[#0d3f1e]">
          {calendarNavigation.label}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[#4a5d4f]">
          {calendarNavigation.description}
        </p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-extrabold text-[#0a7a37]">
          {calendarNavigation.ctaLabel}
          <ExternalLink className="size-4" aria-hidden="true" />
        </span>
      </span>
    </a>
  )
}
