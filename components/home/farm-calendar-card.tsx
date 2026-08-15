import { CalendarDays, ExternalLink } from "lucide-react"
import { FARM_CALENDAR_URL } from "@/lib/farm-calendar"

export function FarmCalendarCard() {
  return (
    <a
      href={FARM_CALENDAR_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open Farm Calendar in a new tab"
      className="flex min-h-[280px] gap-5 rounded-xl border border-[#dce9dc] bg-white/95 p-6 text-[#071f13] shadow-[0_8px_22px_rgba(0,0,0,0.09)] transition-shadow hover:shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
    >
      <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#e5f3e2] text-[#0a7a37] sm:size-24">
        <CalendarDays className="size-12" aria-hidden="true" />
      </span>

      <span className="flex flex-1 flex-col">
        <h3 className="text-xl font-extrabold uppercase leading-tight text-[#0d3f1e]">
          Farm Calendar
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[#4a5d4f]">
          Open the Muthu Farms calendar in Google Calendar.
        </p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-extrabold text-[#0a7a37]">
          Open Farm Calendar
          <ExternalLink className="size-4" aria-hidden="true" />
        </span>
      </span>
    </a>
  )
}
