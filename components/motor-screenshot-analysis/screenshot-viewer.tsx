"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getFallbackMotor } from "@/lib/motor-screenshot-analysis-config"
import type { RunRecord } from "@/lib/motor-screenshot-analysis-types"
import { formatDate } from "@/lib/motor-screenshot-analysis-format"
import { StatusBadge } from "./status-badge"

export function ScreenshotViewer({
  record,
  onClose,
}: {
  record: RunRecord | null
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!record) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    closeRef.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
    }
  }, [record, onClose])

  if (!record) return null

  const motor = getFallbackMotor(record.motorId)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="screenshot-viewer-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <h2
              id="screenshot-viewer-title"
              className="font-serif text-lg font-bold text-foreground"
            >
              Source screenshot
            </h2>
            <p className="text-sm text-muted-foreground">{record.screenshotName}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Screenshot placeholder — no OCR performed */}
          {record.screenshotId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/motor-screenshot-analysis/uploads/${record.screenshotId}/image`}
              alt={`Source screenshot for ${record.motorName}`}
              className="max-h-[52vh] w-full rounded-lg border border-border bg-muted object-contain"
            />
          ) : (
            <p className="rounded-lg border border-border bg-muted/50 p-6 text-center text-sm text-muted-foreground">
              No retained screenshot is linked to this record.
            </p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Assigned motor</dt>
              <dd className="flex items-center gap-1.5 font-medium text-foreground">
                <span className={cn("size-2 rounded-full", motor.dotClass)} aria-hidden="true" />
                {record.motorName || motor.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Date</dt>
              <dd className="font-medium text-foreground">{formatDate(record.date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Matching status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={record.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Run</dt>
              <dd className="font-medium text-foreground">{record.run}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Extracted messages
            </p>
            <ul className="flex flex-col gap-1.5">
              {record.extractedMessages.map((m, i) => (
                <li
                  key={`${m.time}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-muted-foreground">{m.time}</span>
                  <span className="flex-1 font-medium text-foreground">{m.text}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                      m.kind === "command"
                        ? "bg-chart-2/15 text-chart-2"
                        : m.kind === "status"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {m.kind}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {record.matchingNote}
            </p>
          </div>
        </div>

        <div className="border-t border-border p-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
