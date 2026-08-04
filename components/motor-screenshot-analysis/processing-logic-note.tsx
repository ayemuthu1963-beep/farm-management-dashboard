"use client"

import { useState } from "react"
import { ChevronDown, Info, ListChecks } from "lucide-react"
import { cn } from "@/lib/utils"

const LOGIC_POINTS = [
  "Each vertically arranged message tile is treated separately.",
  "Only first lines beginning with MOTOR or MTR are considered.",
  "MTRON and MTROF are command messages.",
  "MOTOR ON and MOTOR OFF are actual motor-status messages.",
  "Runtime is calculated from actual MOTOR ON to actual MOTOR OFF.",
  "MTRON is matched 30–180 seconds before MOTOR ON; MTROF is matched 0–180 seconds before MOTOR OFF.",
  "Ambiguous extraction or command matches remain visible for owner review and are never guessed.",
  "Unmatched records are identified and excluded from the confirmed runtime total.",
  "Exact timestamps and runtime seconds are stored; normal reports round only the final displayed value.",
]

export function ProcessingLogicNote() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-border bg-accent/40">
      <div className="flex gap-3 p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-foreground">
          Screenshots are validated, hashed and stored privately by the authenticated MFMS backend.
          Extracted candidates require owner review before MOTOR ON/OFF sessions affect confirmed totals.
        </p>
      </div>

      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-accent/60"
        >
          <span className="flex items-center gap-2">
            <ListChecks className="size-4 text-muted-foreground" aria-hidden="true" />
            Processing Logic
          </span>
          <ChevronDown
            className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {open && (
          <ul className="space-y-2 px-4 pb-4 pl-11 text-sm text-muted-foreground">
            {LOGIC_POINTS.map((point) => (
              <li key={point} className="list-disc leading-relaxed marker:text-primary">
                {point}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
