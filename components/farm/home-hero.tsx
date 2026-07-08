import Image from "next/image"
import { LogOut, CheckCircle2, CalendarDays, Clock } from "lucide-react"
import { todayDate, todayTime } from "@/lib/well-data"

const taglines = ["DATA DRIVEN", "SMARTER DECISIONS", "BETTER YIELD"]

export function HomeHero() {
  return (
    <header className="relative isolate overflow-hidden rounded-2xl border border-border shadow-sm">
      <Image
        src="/home-hero.png"
        alt="Aerial view of Muthu Farms with a survey drone and field analytics on tablet and phone"
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover"
      />
      {/* Readability overlay, darker on the left where the text sits */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background/85 via-background/45 to-transparent" />

      {/* Muthu Farms brand logo */}
      <div className="pointer-events-none absolute left-2 top-10 z-10 w-24 sm:left-6 sm:top-10 sm:w-36 lg:left-10 lg:w-44">
        <Image
          src="/muthu-farms-logo-full.png"
          alt="Muthu Farms logo"
          width={360}
          height={360}
          priority
          className="w-full object-contain drop-shadow-xl"
        />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-end gap-2 p-3 sm:p-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Logout
        </button>
      </div>

      {/* Title block */}
      <div className="max-w-2xl pl-28 pr-4 pb-6 pt-6 sm:pb-12 sm:pt-10 lg:pt-16 sm:pl-44 lg:pl-56 sm:pr-8">
        <h1 className="text-3xl font-extrabold leading-none tracking-tight text-primary drop-shadow-sm sm:text-5xl lg:text-6xl">
          MUTHU&apos;S
        </h1>
        <p className="mt-2 text-base font-semibold tracking-wide text-foreground sm:text-2xl lg:text-3xl">
          DIGITAL FARM MANAGEMENT SYSTEM
        </p>
        <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {taglines.map((t) => (
            <li key={t} className="flex items-center gap-1.5 text-xs font-semibold text-primary sm:text-sm">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>

        <div className="mt-5 inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-card/80 px-3 py-2 text-xs text-foreground shadow-sm ring-1 ring-border backdrop-blur sm:text-sm">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            {todayDate}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4 text-primary" aria-hidden="true" />
            {todayTime}
          </span>
        </div>
      </div>
    </header>
  )
}
