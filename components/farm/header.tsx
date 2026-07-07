import Image from "next/image"
import { Home, LogOut, CheckCircle2 } from "lucide-react"

const taglines = ["DATA DRIVEN", "SMARTER DECISIONS", "BETTER YIELD"]

export function Header() {
  return (
    <header className="relative isolate overflow-hidden rounded-xl border border-border">
      {/* Banner background */}
      <Image
        src="/farm-banner.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background/70 via-background/30 to-background/50" />

      <div className="flex flex-col items-center gap-4 px-4 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-6">
        {/* Logo */}
        <div className="shrink-0 rounded-full bg-card/90 p-1 shadow-md ring-1 ring-border">
          <Image
            src="/muthu-farms-logo.png"
            alt="Muthu Farms logo"
            width={96}
            height={96}
            className="size-16 rounded-full object-cover sm:size-24"
          />
        </div>

        {/* Title block */}
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-extrabold leading-none tracking-tight text-primary sm:text-4xl lg:text-5xl">
            MUTHU&apos;S
          </h1>
          <p className="mt-1 text-sm font-semibold tracking-wide text-foreground sm:text-xl lg:text-2xl">
            DIGITAL FARM MANAGEMENT SYSTEM
          </p>
          <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {taglines.map((t) => (
              <li key={t} className="flex items-center gap-1 text-[11px] font-semibold text-primary sm:text-xs">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            <Home className="size-4" aria-hidden="true" />
            Home
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
