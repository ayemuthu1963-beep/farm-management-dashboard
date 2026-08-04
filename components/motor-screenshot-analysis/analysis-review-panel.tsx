"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, RefreshCw, Save, Trash2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatExactRuntime } from "@/lib/motor-screenshot-analysis-format"
import type { GeometryBox, Motor, ReviewMessage, UploadDetail } from "@/lib/motor-screenshot-analysis-types"
import { MotorBadge } from "./motor-badge"

const fieldClass = "w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"

function localDateTime(value: string | null): string {
  if (!value) return ""
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "00"
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`
}

function indiaIso(value: string): string | null {
  return value ? new Date(`${value}+05:30`).toISOString() : null
}

function exactClock(value: string | null): string {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value))
}

function TilePreview({ uploadId, box, tile }: { uploadId: number; box?: GeometryBox | null; tile: number }) {
  if (!box || box.x1 <= box.x0 || box.y1 <= box.y0) return null
  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-border bg-muted" role="img" aria-label={`Cropped source preview for tile ${tile}`}>
      <svg viewBox={`${box.x0} ${box.y0} ${box.x1 - box.x0} ${box.y1 - box.y0}`} className="h-24 w-full" preserveAspectRatio="xMidYMid meet">
        <image href={`/api/motor-screenshot-analysis/uploads/${uploadId}/image`} x="0" y="0" width="1" height="1" preserveAspectRatio="none" />
      </svg>
    </div>
  )
}

export function AnalysisReviewPanel({
  detail,
  motors,
  busy,
  onSave,
  onConfirm,
  onReject,
  onReanalyse,
  onDelete,
}: {
  detail: UploadDetail
  motors: Motor[]
  busy: boolean
  onSave: (messages: ReviewMessage[]) => Promise<void>
  onConfirm: (messages: ReviewMessage[]) => Promise<void>
  onReject: () => Promise<void>
  onReanalyse: () => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [messages, setMessages] = useState(detail.messages)
  useEffect(() => setMessages(detail.messages), [detail])
  const motor = motors.find((item) => item.id === detail.upload.motor_id)
  const isScreenshot = detail.upload.source_type === "screenshot"
  const provisionalSessions = detail.provisional_sessions ?? []
  const provisionalComplete = provisionalSessions.filter((session) => session.status === "complete")
  const provisionalSeconds = provisionalComplete.reduce((sum, session) => sum + (session.runtime_seconds ?? 0), 0)
  const warningCount = messages.filter((message) => message.included && (
    message.event_type === "unknown"
    || !message.event_timestamp
    || (Boolean(message.parser_warning) && !["corrected", "confirmed"].includes(message.review_status))
    || message.review_status === "needs_review"
    || (message.confidence ?? 1) < 0.8
  )).length

  function update(id: number, patch: Partial<ReviewMessage>) {
    setMessages((current) => current.map((message) => message.id === id ? { ...message, ...patch } : message))
  }

  return (
    <section aria-labelledby="analysis-review-heading" className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="analysis-review-heading" className="font-serif text-lg font-bold text-foreground">Owner extraction review</h2>
          <p className="text-sm text-muted-foreground">Inspect every candidate before it can affect confirmed runtime totals.</p>
        </div>
        <div className="flex items-center gap-2">
          <MotorBadge motorId={detail.upload.motor_id} name={motor?.name} />
          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{detail.upload.analysis_status.replaceAll("_", " ")}</span>
        </div>
      </div>

      {detail.upload.error_message && (
        <div className="mt-4 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {detail.upload.error_message}
        </div>
      )}

      {provisionalSessions.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/50 p-3 dark:border-amber-700/50 dark:bg-amber-950/20">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Provisional pairing preview</h3>
              <p className="text-xs text-muted-foreground">Candidate sessions only. They do not affect confirmed database totals until owner review is saved.</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p><span className="font-semibold text-foreground">{provisionalComplete.length}</span> complete candidate sessions</p>
              <p><span className="font-semibold text-foreground">{formatExactRuntime(provisionalSeconds)}</span> candidate runtime</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {provisionalSessions.map((session, index) => (
              <div key={`${session.status}-${session.motor_on_message_id ?? "none"}-${session.motor_off_message_id ?? "none"}-${index}`} className="rounded-lg border border-border bg-background p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">Candidate {index + 1}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">{session.status.replaceAll("_", " ")}</span>
                </div>
                <p className="mt-1 text-muted-foreground">ON <span className="font-medium text-foreground">{exactClock(session.motor_on_at)}</span> · OFF <span className="font-medium text-foreground">{exactClock(session.motor_off_at)}</span></p>
                <p className="text-muted-foreground">Exact runtime <span className="font-medium text-foreground">{session.runtime_seconds == null ? "—" : formatExactRuntime(session.runtime_seconds)}</span></p>
                {session.requires_owner_confirmation && <p className="mt-1 text-amber-700 dark:text-amber-300">Owner confirmation required</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,2fr)]">
        <div>
          {isScreenshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/motor-screenshot-analysis/uploads/${detail.upload.id}/image`}
              alt={`Uploaded source ${detail.upload.original_filename}`}
              className="max-h-[65vh] w-full rounded-lg border border-border bg-muted object-contain"
            />
          ) : (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imported source text</p>
              <pre className="mt-2 max-h-[65vh] overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">{detail.upload.raw_text}</pre>
            </div>
          )}
          <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between gap-3"><dt>Source</dt><dd className="truncate font-medium text-foreground">{detail.upload.original_filename}</dd></div>
            <div className="flex justify-between gap-3"><dt>Source type</dt><dd className="font-medium text-foreground">{detail.upload.source_type.replaceAll("_", " ")}</dd></div>
            <div className="flex justify-between gap-3"><dt>Provider</dt><dd className="font-medium text-foreground">{detail.upload.extractor_provider}</dd></div>
            {detail.upload.parser_version && <div className="flex justify-between gap-3"><dt>Parser</dt><dd className="font-medium text-foreground">{detail.upload.parser_version}</dd></div>}
            <div className="flex justify-between gap-3"><dt>Messages</dt><dd className="font-medium text-foreground">{messages.length}</dd></div>
            {isScreenshot && <div className="flex justify-between gap-3"><dt>Vision units</dt><dd className="font-medium text-foreground">{detail.usage.reduce((sum, row) => sum + row.unit_count, 0)}</dd></div>}
          </dl>
          {detail.usage.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">OCR audit</p>
              {detail.usage.map((row) => (
                <p key={row.id} className="mt-1">
                  {row.feature} · attempt {row.attempt_number} · {row.status}
                  {row.processing_duration_ms != null ? ` · ${row.processing_duration_ms} ms` : ""}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {messages.map((message) => (
            <article key={message.id} className="rounded-xl border border-border bg-background p-3">
              {isScreenshot && <TilePreview uploadId={detail.upload.id} box={message.geometry?.tile} tile={message.tile_index + 1} />}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{isScreenshot ? "Tile" : "Imported record"} {message.tile_index + 1}</p>
                <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <input type="checkbox" checked={message.included} onChange={(event) => update(message.id, { included: event.target.checked })} />
                  Include
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2 text-xs font-medium text-foreground">Raw first line
                  <input value={message.raw_first_line} onChange={(event) => update(message.id, { raw_first_line: event.target.value })} className={`mt-1 ${fieldClass}`} />
                </label>
                <div className="sm:col-span-2 text-xs text-muted-foreground">
                  Parsed first line: <span className="font-medium text-foreground">{message.normalized_line}</span>
                </div>
                <label className="text-xs font-medium text-foreground">Original date text
                  <input value={message.original_date_text} onChange={(event) => update(message.id, { original_date_text: event.target.value })} className={`mt-1 ${fieldClass}`} />
                </label>
                <label className="text-xs font-medium text-foreground">Original time text
                  <input value={message.original_time_text} onChange={(event) => update(message.id, { original_time_text: event.target.value })} className={`mt-1 ${fieldClass}`} />
                </label>
                <label className="text-xs font-medium text-foreground">Parsed date and time (exact)
                  <input type="datetime-local" step="1" value={localDateTime(message.event_timestamp)} onChange={(event) => update(message.id, { event_timestamp: indiaIso(event.target.value) })} className={`mt-1 ${fieldClass}`} />
                </label>
                <label className="text-xs font-medium text-foreground">Event type
                  <select value={message.event_type} onChange={(event) => update(message.id, { event_type: event.target.value as ReviewMessage["event_type"] })} className={`mt-1 ${fieldClass}`}>
                    <option value="mtr_on_command">MTRON command</option>
                    <option value="mtr_off_command">MTROF command</option>
                    <option value="motor_on">MOTOR ON</option>
                    <option value="motor_off">MOTOR OFF</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-foreground">Command source
                  <select value={message.command_source} onChange={(event) => update(message.id, { command_source: event.target.value as ReviewMessage["command_source"] })} className={`mt-1 ${fieldClass}`}>
                    <option value="rtc">RTC</option><option value="phone">Phone</option><option value="unknown">Unknown</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-foreground">Device name
                  <input value={message.device_name ?? ""} onChange={(event) => update(message.id, { device_name: event.target.value || null })} className={`mt-1 ${fieldClass}`} />
                </label>
                <label className="text-xs font-medium text-foreground">Review notes
                  <input value={message.review_notes ?? ""} onChange={(event) => update(message.id, { review_notes: event.target.value || null })} className={`mt-1 ${fieldClass}`} />
                </label>
                <div className="text-xs text-muted-foreground">
                  Confidence: <span className="font-medium text-foreground">{message.confidence == null ? "Not supplied" : `${Math.round(message.confidence * 100)}%`}</span>
                  <br />Source imports: <span className="font-medium text-foreground">{message.source_count}</span>
                </div>
              </div>
              {(message.event_type === "unknown" || message.review_status === "needs_review") && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive"><AlertTriangle className="size-3.5" /> Resolve or exclude this uncertain result.</p>
              )}
              {message.parser_warning && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{message.parser_warning}</p>
              )}
            </article>
          ))}
          {messages.length === 0 && <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No extracted message candidates are available.</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" disabled={busy || messages.length === 0} onClick={() => onSave(messages)}><Save className="size-4" /> Save Corrections</Button>
        <Button type="button" disabled={busy || messages.length === 0 || warningCount > 0} onClick={() => onConfirm(messages)}><CheckCircle2 className="size-4" /> Confirm and Save</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onReanalyse}><RefreshCw className="size-4" /> {isScreenshot ? "Reanalyse" : "Parse Again"}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onReject}><XCircle className="size-4" /> {isScreenshot ? "Reject Analysis" : "Reject Import"}</Button>
        {!isScreenshot && <Button type="button" variant="outline" disabled={busy} onClick={onDelete}><Trash2 className="size-4" /> Delete Import</Button>}
        {warningCount > 0 && <span className="text-xs text-destructive">{warningCount} included candidate{warningCount === 1 ? "" : "s"} still require review.</span>}
      </div>
    </section>
  )
}
