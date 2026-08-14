"use client"

import { CalendarDays, ExternalLink, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import {
  FARM_CALENDAR_MONTH_URL,
  FARM_CALENDAR_TIME_ZONE,
  FARM_CALENDAR_WEEKLY_EMBED_URL,
} from "@/lib/farm-calendar"

type CalendarFrameStatus = "loading" | "ready" | "error"

export function FarmCalendarCard() {
  const [status, setStatus] = useState<CalendarFrameStatus>("loading")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (status !== "loading") return

    const timeout = window.setTimeout(() => setStatus("error"), 12_000)
    return () => window.clearTimeout(timeout)
  }, [attempt, status])

  const retry = () => {
    setStatus("loading")
    setAttempt((current) => current + 1)
  }

  return (
    <article className="flex min-h-[280px] flex-col rounded-xl border border-[#dce9dc] bg-white/95 p-4 text-[#071f13] shadow-[0_8px_22px_rgba(0,0,0,0.09)]">
      <header className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#e5f3e2] text-[#0a7a37]">
          <CalendarDays className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-xl font-extrabold uppercase leading-tight text-[#0d3f1e]">
            Farm Calendar
          </h3>
          <p className="text-xs font-semibold text-[#4a5d4f]">
            Current week · {FARM_CALENDAR_TIME_ZONE}
          </p>
        </div>
      </header>

      <div className="relative mt-3 h-[142px] overflow-hidden rounded-lg border border-[#dce9dc] bg-[#f7fbf5] sm:h-[150px]">
        <iframe
          key={attempt}
          title="Farm Calendar current week"
          src={FARM_CALENDAR_WEEKLY_EMBED_URL}
          className={`h-full w-full bg-white transition-opacity ${status === "ready" ? "opacity-100" : "opacity-0"}`}
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
        />

        {status === "loading" ? (
          <div
            className="absolute inset-0 flex items-center justify-center gap-2 px-4 text-center text-sm font-semibold text-[#4a5d4f]"
            role="status"
            aria-live="polite"
          >
            <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
            Loading private calendar…
          </div>
        ) : null}

        {status === "error" ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-[#4a5d4f]"
            role="alert"
          >
            <span>Calendar could not be loaded. Confirm Google access and try again.</span>
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#b8d6b8] bg-white px-3 py-1.5 text-xs font-extrabold text-[#0a7a37]"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : null}
      </div>

      <p className="mt-2 text-xs leading-snug text-[#4a5d4f]">
        A blank week means no events are scheduled. Access follows your signed-in Google account.
      </p>

      <a
        href={FARM_CALENDAR_MONTH_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-extrabold text-[#0a7a37]"
      >
        Open Monthly Calendar
        <ExternalLink className="size-4" aria-hidden="true" />
      </a>
    </article>
  )
}
