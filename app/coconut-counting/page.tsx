import Link from "next/link"
import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  Hash,
  MapPin,
  RefreshCw,
  Scale,
  Sprout,
} from "lucide-react"

import { CoconutCountingPageHeader } from "@/components/coconut-counting/page-header"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import {
  CoconutCountingApiError,
  getCoconutCountingDashboard,
  getCoconutCountingSessionDetail,
  type CoconutCountingDashboardData,
  type CoconutCountingEntry,
  type CoconutCountingFilters,
  type CoconutCountingSession,
  type CoconutCountingSessionDetail,
  type CoconutNumeric,
} from "@/lib/coconut-counting-api"

export const dynamic = "force-dynamic"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const numberFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 })

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function farmTodayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

function subtractDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

function validIsoDate(value: string | undefined, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? fallback : value
}

function formatNumber(value: CoconutNumeric | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"
  const number = Number(value)
  return Number.isFinite(number) ? numberFormatter.format(number) : "—"
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date)
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

function statusClass(status: CoconutCountingSession["status"]): string {
  if (status === "ACTIVE") return "border-amber-300 bg-amber-100 text-amber-900"
  if (status === "COMPLETED") return "border-emerald-300 bg-emerald-100 text-emerald-900"
  return "border-slate-300 bg-slate-100 text-slate-800"
}

function selectedSessionHref(filters: CoconutCountingFilters, sessionUuid: string): string {
  const params = new URLSearchParams({
    from: filters.fromDate,
    to: filters.toDate,
    session: sessionUuid,
  })
  if (filters.status) params.set("status", filters.status)
  const page = Math.floor((filters.offset ?? 0) / (filters.limit ?? 50)) + 1
  if (page > 1) params.set("page", String(page))
  return `/coconut-counting?${params.toString()}#session-detail`
}

function pageHref(filters: CoconutCountingFilters, page: number): string {
  const params = new URLSearchParams({ from: filters.fromDate, to: filters.toDate })
  if (filters.status) params.set("status", filters.status)
  if (page > 1) params.set("page", String(page))
  return `/coconut-counting?${params.toString()}`
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Database }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-black tabular-nums text-foreground">{value}</p>
    </article>
  )
}

function FilterForm({ filters }: { filters: CoconutCountingFilters }) {
  return (
    <form method="get" className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto_auto] xl:items-end">
      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        From date
        <input type="date" name="from" defaultValue={filters.fromDate} max={farmTodayIso()} className="h-10 rounded-lg border border-input bg-background px-3 font-normal" />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        To date
        <input type="date" name="to" defaultValue={filters.toDate} max={farmTodayIso()} className="h-10 rounded-lg border border-input bg-background px-3 font-normal" />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        Session status
        <select name="status" defaultValue={filters.status ?? ""} className="h-10 rounded-lg border border-input bg-background px-3 font-normal">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="ENDED">Ended</option>
        </select>
      </label>
      <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90">
        <RefreshCw className="size-4" aria-hidden="true" />
        Apply
      </button>
      <Link href="/coconut-counting" className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-accent">
        Reset
      </Link>
    </form>
  )
}

function SessionTable({ data, filters }: { data: CoconutCountingDashboardData; filters: CoconutCountingFilters }) {
  if (data.sessions.length === 0) {
    return <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No synchronized coconut-counting sessions were found for this date range.</div>
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-labelledby="session-history-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 id="session-history-heading" className="font-bold text-foreground">Session history</h2>
          <p className="text-xs text-muted-foreground">Showing {data.sessions.length} of {data.total} matching sessions</p>
        </div>
        <p className="text-xs text-muted-foreground">Newest harvest date first</p>
      </div>
      <div className="divide-y divide-border xl:hidden">
        {data.sessions.map((session) => (
          <article key={session.session_uuid} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-foreground">{formatDate(session.session_date)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Synchronized {formatDateTime(session.server_updated_at)}</p>
              </div>
              <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${statusClass(session.status)}`}>{session.status}</span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs font-bold uppercase text-muted-foreground">Entries</dt><dd className="mt-1 font-bold tabular-nums">{formatNumber(session.number_of_entries)}</dd></div>
              <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs font-bold uppercase text-muted-foreground">Combined</dt><dd className="mt-1 font-bold tabular-nums">{formatNumber(session.combined_total)}</dd></div>
              <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs font-bold uppercase text-muted-foreground">Physical</dt><dd className="mt-1 font-bold tabular-nums">{formatNumber(session.physical_nuts_counted)}</dd></div>
              <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs font-bold uppercase text-muted-foreground">Harvested</dt><dd className="mt-1 font-bold tabular-nums">{formatNumber(session.total_nuts_harvested)}</dd></div>
            </dl>
            <Link href={selectedSessionHref(filters, session.session_uuid)} className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
              View session <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
      <div className="hidden xl:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-[12%] px-3 py-3">Harvest date</th>
              <th className="w-[11%] px-3 py-3">Status</th>
              <th className="w-[7%] px-3 py-3 text-right">Entries</th>
              <th className="w-[8%] px-3 py-3 text-right">Grade A</th>
              <th className="w-[8%] px-3 py-3 text-right">Grade B</th>
              <th className="w-[9%] px-3 py-3 text-right">Combined</th>
              <th className="w-[11%] px-3 py-3 text-right">Physical</th>
              <th className="w-[11%] px-3 py-3 text-right">Harvested</th>
              <th className="w-[15%] px-3 py-3">Last sync</th>
              <th className="w-[8%] px-3 py-3"><span className="sr-only">View</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.sessions.map((session) => (
              <tr key={session.session_uuid} className="hover:bg-muted/40">
                <td className="px-3 py-3 font-semibold text-foreground">{formatDate(session.session_date)}</td>
                <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${statusClass(session.status)}`}>{session.status}</span></td>
                <td className="px-3 py-3 text-right tabular-nums">{formatNumber(session.number_of_entries)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatNumber(session.total_grade_a)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatNumber(session.total_grade_b)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatNumber(session.combined_total)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatNumber(session.physical_nuts_counted)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatNumber(session.total_nuts_harvested)}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{formatDateTime(session.server_updated_at)}</td>
                <td className="px-3 py-3 text-right">
                  <Link href={selectedSessionHref(filters, session.session_uuid)} className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
                    View <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.total > data.limit ? (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
          <Link
            aria-disabled={data.offset === 0}
            href={data.offset === 0 ? pageHref(filters, 1) : pageHref(filters, Math.floor(data.offset / data.limit))}
            className={`rounded-lg border border-border px-3 py-2 font-semibold ${data.offset === 0 ? "pointer-events-none opacity-40" : "hover:bg-accent"}`}
          >
            Previous
          </Link>
          <span className="text-muted-foreground">Page {Math.floor(data.offset / data.limit) + 1} of {Math.ceil(data.total / data.limit)}</span>
          <Link
            aria-disabled={data.offset + data.limit >= data.total}
            href={data.offset + data.limit >= data.total ? pageHref(filters, Math.ceil(data.total / data.limit)) : pageHref(filters, Math.floor(data.offset / data.limit) + 2)}
            className={`rounded-lg border border-border px-3 py-2 font-semibold ${data.offset + data.limit >= data.total ? "pointer-events-none opacity-40" : "hover:bg-accent"}`}
          >
            Next
          </Link>
        </div>
      ) : null}
    </section>
  )
}

function gpsText(entry: CoconutCountingEntry): string {
  if (entry.gps_status !== "CAPTURED" || entry.latitude === null || entry.longitude === null) return entry.gps_status
  return `${entry.latitude.toFixed(6)}, ${entry.longitude.toFixed(6)}`
}

interface DetailField {
  label: string
  value: string | number | null | undefined
}

function DetailFieldGrid({ fields }: { fields: DetailField[] }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
      {fields.map((field) => (
        <div key={field.label} className="min-w-0 bg-card p-3">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{field.label}</dt>
          <dd className="mt-1 break-words text-sm font-medium text-foreground">{field.value === null || field.value === undefined || field.value === "" ? "—" : field.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function CompleteSessionData({ session }: { session: CoconutCountingSession }) {
  const fields: DetailField[] = [
    { label: "Session UUID", value: session.session_uuid },
    { label: "Harvest date", value: formatDate(session.session_date) },
    { label: "Start time", value: session.start_time },
    { label: "End time", value: session.end_time },
    { label: "Grade A total", value: formatNumber(session.total_grade_a) },
    { label: "Grade B total", value: formatNumber(session.total_grade_b) },
    { label: "Combined total", value: formatNumber(session.combined_total) },
    { label: "Number of entries", value: formatNumber(session.number_of_entries) },
    { label: "Operator identifier", value: session.device_operator_identifier },
    { label: "Status", value: session.status },
    { label: "Total nuts harvested", value: formatNumber(session.total_nuts_harvested) },
    { label: "Source device", value: session.source_device_id },
    { label: "APK created", value: formatDateTime(session.event_created_at) },
    { label: "APK updated", value: formatDateTime(session.event_updated_at) },
    { label: "Server created", value: formatDateTime(session.server_created_at) },
    { label: "Server updated", value: formatDateTime(session.server_updated_at) },
  ]
  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="cursor-pointer px-4 py-3 font-bold text-foreground">Complete session data</summary>
      <div className="border-t border-border p-4"><DetailFieldGrid fields={fields} /></div>
    </details>
  )
}

function CompleteEntryRecords({ entries }: { entries: CoconutCountingEntry[] }) {
  if (!entries.length) return null
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border bg-muted/50 px-4 py-3">
        <h3 className="font-bold text-foreground">Complete entry records</h3>
        <p className="text-xs text-muted-foreground">Open an entry to view every value received from the APK.</p>
      </div>
      <div className="divide-y divide-border">
        {entries.map((entry) => {
          const fields: DetailField[] = [
            { label: "Entry UUID", value: entry.entry_uuid },
            { label: "Session UUID", value: entry.session_uuid },
            { label: "Entry sequence", value: entry.entry_sequence },
            { label: "Entry date/time", value: formatDateTime(entry.entry_datetime) },
            { label: "Entry date", value: formatDate(entry.entry_date) },
            { label: "Entry time", value: entry.entry_time },
            { label: "Grade", value: entry.grade_name },
            { label: "Count type", value: entry.count_type },
            { label: "Pair count", value: formatNumber(entry.pair_count) },
            { label: "Entered pairs", value: formatNumber(entry.entered_pairs) },
            { label: "Pair half-units", value: formatNumber(entry.pair_half_units) },
            { label: "Count value", value: formatNumber(entry.count_value) },
            { label: "Nut count", value: formatNumber(entry.nut_count) },
            { label: "Physical nuts", value: formatNumber(entry.physical_nuts) },
            { label: "Sale half-units", value: formatNumber(entry.sale_equivalent_half_units) },
            { label: "Count rule", value: entry.count_rule },
            { label: "Grade A value", value: formatNumber(entry.grade_a_value) },
            { label: "Grade B value", value: formatNumber(entry.grade_b_value) },
            { label: "Running Grade A", value: formatNumber(entry.running_total_a) },
            { label: "Running Grade B", value: formatNumber(entry.running_total_b) },
            { label: "Running combined", value: formatNumber(entry.running_combined_total) },
            { label: "Latitude", value: entry.latitude },
            { label: "Longitude", value: entry.longitude },
            { label: "Altitude", value: entry.altitude },
            { label: "GPS accuracy", value: entry.gps_accuracy },
            { label: "GPS status", value: entry.gps_status },
            { label: "GPS captured", value: formatDateTime(entry.gps_captured_at) },
            { label: "Device name", value: entry.device_name },
            { label: "APK sync status", value: entry.client_sync_status },
            { label: "APK created", value: formatDateTime(entry.event_created_at) },
            { label: "Server received", value: formatDateTime(entry.server_received_at) },
          ]
          return (
            <details key={entry.entry_uuid} className="bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-foreground">Entry {entry.entry_sequence} · {entry.grade_name} · {entry.count_type}</summary>
              <div className="border-t border-border p-4"><DetailFieldGrid fields={fields} /></div>
            </details>
          )
        })}
      </div>
    </div>
  )
}

function SessionDetail({ detail }: { detail: CoconutCountingSessionDetail }) {
  const session = detail.session
  const recordedTotal = session.total_nuts_harvested
  const physicalCounted = detail.entries.reduce((sum, entry) => sum + (entry.physical_nuts ?? entry.nut_count ?? 0), 0)
  const difference = recordedTotal === null ? null : recordedTotal - physicalCounted

  return (
    <section id="session-detail" className="min-w-0 scroll-mt-5 space-y-4 overflow-hidden rounded-2xl border-2 border-primary/25 bg-card p-4 shadow-sm sm:p-5" aria-labelledby="session-detail-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Selected session</p>
          <h2 id="session-detail-heading" className="mt-1 text-xl font-black text-foreground">{formatDate(session.session_date)}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Session {session.session_uuid}</p>
        </div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(session.status)}`}>{session.status}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Grade A" value={formatNumber(session.total_grade_a)} icon={Sprout} />
        <SummaryCard label="Grade B" value={formatNumber(session.total_grade_b)} icon={Sprout} />
        <SummaryCard label="Combined" value={formatNumber(session.combined_total)} icon={Scale} />
        <SummaryCard label="Physical counted" value={formatNumber(physicalCounted)} icon={Hash} />
        <SummaryCard label="Total harvested" value={formatNumber(recordedTotal)} icon={Database} />
      </div>

      {difference !== null && difference !== 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>The recorded harvest total differs from physical counted entries by <strong>{formatNumber(difference)}</strong>. This is an information warning only; it does not invalidate or block the session.</span>
        </div>
      ) : null}

      <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-muted/60 p-3"><span className="block text-xs font-bold uppercase text-muted-foreground">Started</span><span className="mt-1 block font-semibold">{session.start_time}</span></div>
        <div className="rounded-lg bg-muted/60 p-3"><span className="block text-xs font-bold uppercase text-muted-foreground">Ended</span><span className="mt-1 block font-semibold">{session.end_time ?? "Not ended"}</span></div>
        <div className="rounded-lg bg-muted/60 p-3"><span className="block text-xs font-bold uppercase text-muted-foreground">Source device</span><span className="mt-1 block font-semibold">{session.source_device_id}</span></div>
        <div className="rounded-lg bg-muted/60 p-3"><span className="block text-xs font-bold uppercase text-muted-foreground">Last synchronized</span><span className="mt-1 block font-semibold">{formatDateTime(session.server_updated_at)}</span></div>
      </div>

      <CompleteSessionData session={session} />

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-muted/50 px-4 py-3"><h3 className="font-bold text-foreground">Count entries</h3><p className="text-xs text-muted-foreground">Capture timestamps are preserved; the harvest date follows the selected session date.</p></div>
        <div className="divide-y divide-border xl:hidden">
          {detail.entries.map((entry) => (
            <article key={entry.entry_uuid} className="space-y-3 p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-bold text-foreground">Entry {entry.entry_sequence} · {entry.grade_name}</p><p className="text-xs text-muted-foreground">{entry.entry_time} · {formatDateTime(entry.entry_datetime)}</p></div>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{entry.count_type}</span>
              </div>
              <dl className="grid grid-cols-3 gap-2">
                <div><dt className="text-xs font-bold uppercase text-muted-foreground">Pairs</dt><dd className="mt-1 font-semibold tabular-nums">{formatNumber(entry.entered_pairs ?? entry.pair_count)}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-muted-foreground">Physical</dt><dd className="mt-1 font-semibold tabular-nums">{formatNumber(entry.physical_nuts ?? entry.nut_count)}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-muted-foreground">Sale count</dt><dd className="mt-1 font-semibold tabular-nums">{formatNumber(entry.count_value)}</dd></div>
              </dl>
              <p className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3.5" aria-hidden="true" />{gpsText(entry)}</p>
            </article>
          ))}
        </div>
        <div className="hidden xl:block">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Captured</th><th className="px-4 py-3">Grade</th><th className="px-4 py-3">Count type</th><th className="px-4 py-3 text-right">Pairs</th><th className="px-4 py-3 text-right">Physical nuts</th><th className="px-4 py-3 text-right">Sale count</th><th className="px-4 py-3">GPS</th></tr></thead>
            <tbody className="divide-y divide-border">
              {detail.entries.map((entry) => (
                <tr key={entry.entry_uuid}><td className="px-3 py-3 font-bold">{entry.entry_sequence}</td><td className="px-3 py-3"><span className="block font-medium">{entry.entry_time}</span><span className="text-xs text-muted-foreground">{formatDateTime(entry.entry_datetime)}</span></td><td className="px-3 py-3">{entry.grade_name}</td><td className="px-3 py-3">{entry.count_type}</td><td className="px-3 py-3 text-right tabular-nums">{formatNumber(entry.entered_pairs ?? entry.pair_count)}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{formatNumber(entry.physical_nuts ?? entry.nut_count)}</td><td className="px-3 py-3 text-right tabular-nums">{formatNumber(entry.count_value)}</td><td className="px-3 py-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{gpsText(entry)}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {detail.entries.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">No entries were synchronized for this session.</p> : null}
      </div>

      <CompleteEntryRecords entries={detail.entries} />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-muted/50 px-4 py-3"><h3 className="font-bold">Harvest date amendments</h3></div>
          {detail.harvest_date_revisions.length ? <ul className="divide-y divide-border">{detail.harvest_date_revisions.map((revision) => <li key={revision.revision_uuid} className="space-y-2 px-4 py-3 text-sm"><p><strong>{formatDate(revision.previous_date)}</strong> to <strong>{formatDate(revision.new_date)}</strong></p><dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2"><div><dt className="inline font-bold">Revision:</dt> <dd className="inline">{revision.revision_number} · {revision.revision_uuid}</dd></div><div><dt className="inline font-bold">APK created:</dt> <dd className="inline">{formatDateTime(revision.event_created_at)}</dd></div><div><dt className="inline font-bold">Server received:</dt> <dd className="inline">{formatDateTime(revision.server_received_at)}</dd></div></dl></li>)}</ul> : <p className="px-4 py-6 text-sm text-muted-foreground">No date amendments.</p>}
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-muted/50 px-4 py-3"><h3 className="font-bold">Total nuts amendments</h3></div>
          {detail.total_nuts_revisions.length ? <ul className="divide-y divide-border">{detail.total_nuts_revisions.map((revision) => <li key={revision.revision_uuid} className="space-y-2 px-4 py-3 text-sm"><p><strong>{formatNumber(revision.previous_total_nuts)}</strong> to <strong>{formatNumber(revision.new_total_nuts)}</strong></p><dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2"><div><dt className="inline font-bold">Adjusted harvest:</dt> <dd className="inline">{formatNumber(revision.adjusted_harvest_total)}</dd></div><div><dt className="inline font-bold">B1 physical:</dt> <dd className="inline">{formatNumber(revision.b1_physical)}</dd></div><div><dt className="inline font-bold">B2 physical:</dt> <dd className="inline">{formatNumber(revision.b2_physical)}</dd></div><div><dt className="inline font-bold">Revision:</dt> <dd className="inline">{revision.revision_number} · {revision.revision_uuid}</dd></div><div><dt className="inline font-bold">APK created:</dt> <dd className="inline">{formatDateTime(revision.event_created_at)}</dd></div><div><dt className="inline font-bold">Server received:</dt> <dd className="inline">{formatDateTime(revision.server_received_at)}</dd></div></dl></li>)}</ul> : <p className="px-4 py-6 text-sm text-muted-foreground">No total amendments.</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-muted/50 px-4 py-3"><h3 className="font-bold">Session reset links</h3><p className="text-xs text-muted-foreground">Shows this session's relationship to the session before or after an APK reset.</p></div>
        {detail.reset_events.length ? <ul className="divide-y divide-border">{detail.reset_events.map((event) => <li key={event.operation_uuid} className="space-y-2 px-4 py-3 text-sm"><p><strong>Prior session:</strong> {event.prior_session_uuid}</p><p><strong>New session:</strong> {event.new_session_uuid}</p><dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2"><div><dt className="inline font-bold">Operation:</dt> <dd className="inline">{event.operation_uuid}</dd></div><div><dt className="inline font-bold">Source device:</dt> <dd className="inline">{event.source_device_id}</dd></div><div><dt className="inline font-bold">APK created:</dt> <dd className="inline">{formatDateTime(event.event_created_at)}</dd></div><div><dt className="inline font-bold">Server received:</dt> <dd className="inline">{formatDateTime(event.server_received_at)}</dd></div></dl></li>)}</ul> : <p className="px-4 py-6 text-sm text-muted-foreground">No reset links for this session.</p>}
      </div>
    </section>
  )
}

export default async function CoconutCountingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const today = farmTodayIso()
  const fromDate = validIsoDate(single(params.from), subtractDays(today, 30))
  const toDate = validIsoDate(single(params.to), today)
  const requestedStatus = single(params.status)
  const status = requestedStatus === "ACTIVE" || requestedStatus === "COMPLETED" || requestedStatus === "ENDED" ? requestedStatus : undefined
  const requestedPage = Number.parseInt(single(params.page) ?? "1", 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const filters: CoconutCountingFilters = { fromDate, toDate, status, limit: 50, offset: (page - 1) * 50 }
  const selectedSession = single(params.session)

  let dashboard: CoconutCountingDashboardData | null = null
  let detail: CoconutCountingSessionDetail | null = null
  let errorMessage: string | null = null
  let detailError: string | null = null

  if (fromDate > toDate) {
    errorMessage = "From date cannot be after To date."
  } else {
    try {
      dashboard = await getCoconutCountingDashboard(filters)
    } catch (error) {
      errorMessage = error instanceof CoconutCountingApiError ? error.message : "Unable to load Coconut Counting data."
    }
  }

  if (dashboard && selectedSession) {
    try {
      detail = await getCoconutCountingSessionDetail(selectedSession)
    } catch (error) {
      detailError = error instanceof CoconutCountingApiError ? error.message : "Unable to load the selected session."
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-5 overflow-x-hidden p-3 sm:p-5">
        <Header />
        <CoconutCountingPageHeader />
        <FilterForm filters={filters} />

        {errorMessage ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{errorMessage}</div> : null}

        {dashboard ? (
          <>
            <section aria-label="Coconut Counting summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
              <SummaryCard label="Sessions" value={formatNumber(dashboard.summary.session_count)} icon={CalendarDays} />
              <SummaryCard label="Entries" value={formatNumber(dashboard.summary.entry_count)} icon={Hash} />
              <SummaryCard label="Grade A" value={formatNumber(dashboard.summary.total_grade_a)} icon={Sprout} />
              <SummaryCard label="Grade B" value={formatNumber(dashboard.summary.total_grade_b)} icon={Sprout} />
              <SummaryCard label="Combined" value={formatNumber(dashboard.summary.combined_total)} icon={Scale} />
              <SummaryCard label="Physical counted" value={formatNumber(dashboard.summary.physical_nuts_counted)} icon={Scale} />
              <SummaryCard label="Total harvested" value={formatNumber(dashboard.summary.recorded_harvested_nuts)} icon={Database} />
            </section>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden="true" />Latest harvest: {formatDate(dashboard.summary.latest_session_date)}</span>
              <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" aria-hidden="true" />Server values are read live; the APK remains local-first when offline.</span>
            </div>

            <SessionTable data={dashboard} filters={filters} />
          </>
        ) : null}

        {detailError ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{detailError}</div> : null}
        {detail ? <SessionDetail detail={detail} /> : null}
      </div>
    </DashboardShell>
  )
}
