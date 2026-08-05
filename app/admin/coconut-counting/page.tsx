import Link from "next/link"
import { Calculator, ChevronRight, CircleAlert, ShieldCheck } from "lucide-react"
import { CoconutCountingAdminClient } from "@/components/admin/coconut-counting-admin-client"
import { PreviewAdminNotice } from "@/components/admin/preview-admin-notice"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import {
  CoconutCountingApiError,
  getCoconutCountingDashboard,
  getCoconutCountingSessionDetail,
  type CoconutCountingDashboardData,
  type CoconutCountingSessionDetail,
} from "@/lib/coconut-counting-api"

export const dynamic = "force-dynamic"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function farmTodayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

function subtractDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

function validIsoDate(value: string | undefined, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? fallback : value
}

function sessionHref(fromDate: string, toDate: string, sessionUuid: string): string {
  const params = new URLSearchParams({ from: fromDate, to: toDate, session: sessionUuid })
  return `/admin/coconut-counting?${params.toString()}#admin-editor`
}

export default async function CoconutCountingAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const today = farmTodayIso()
  const fromDate = validIsoDate(single(params.from), subtractDays(today, 30))
  const toDate = validIsoDate(single(params.to), today)
  const requestedSession = single(params.session)
  let dashboard: CoconutCountingDashboardData | null = null
  let detail: CoconutCountingSessionDetail | null = null
  let errorMessage: string | null = null

  if (fromDate > toDate) {
    errorMessage = "From date cannot be after To date."
  } else {
    try {
      dashboard = await getCoconutCountingDashboard({ fromDate, toDate, limit: 50, offset: 0 })
      const selectedUuid = requestedSession && dashboard.sessions.some(session => session.session_uuid === requestedSession)
        ? requestedSession
        : dashboard.sessions[0]?.session_uuid
      if (selectedUuid) detail = await getCoconutCountingSessionDetail(selectedUuid)
    } catch (error) {
      errorMessage = error instanceof CoconutCountingApiError ? error.message : "Unable to load Coconut Counting admin data."
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-5 overflow-x-hidden p-3 sm:p-5">
        <Header />
        <nav aria-label="Breadcrumb"><ol className="flex items-center gap-1 text-sm text-muted-foreground"><li><Link href="/">Home</Link></li><ChevronRight className="size-4" /><li><Link href="/admin">Admin Console</Link></li><ChevronRight className="size-4" /><li className="font-medium text-foreground">Coconut Counting</li></ol></nav>
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3"><span className="rounded-xl bg-amber-600 p-3 text-white"><ShieldCheck className="size-6" /></span><div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Protected Preview tool</p><h1 className="mt-1 text-2xl font-black uppercase text-amber-950">Coconut Counting Admin Edit</h1><p className="mt-1 max-w-3xl text-sm text-amber-900">Edit Coconut Counting business values only. Technical IDs and server audit records remain read-only, and every save creates a before/after audit record. Finish and sync an active APK session before editing it, otherwise a later APK sync can replace the server values.</p></div></div>
            <Link href={`/coconut-counting?from=${fromDate}&to=${toDate}`} className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-bold text-amber-950 hover:bg-amber-100">Back to webpage</Link>
          </div>
        </section>
        <PreviewAdminNotice />
        <form method="get" className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="grid gap-1.5 text-sm font-bold">From date<input name="from" type="date" max={today} defaultValue={fromDate} className="h-10 rounded-lg border border-input bg-background px-3 font-normal" /></label>
          <label className="grid gap-1.5 text-sm font-bold">To date<input name="to" type="date" max={today} defaultValue={toDate} className="h-10 rounded-lg border border-input bg-background px-3 font-normal" /></label>
          <button className="h-10 rounded-lg bg-primary px-4 text-sm font-black text-primary-foreground">Load sessions</button>
          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">Use the same From and To date for one day. Both dates are included.</p>
        </form>
        {errorMessage ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" />{errorMessage}</div> : null}
        {dashboard ? (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><Calculator className="size-5 text-primary" /><div><h2 className="font-black uppercase">Select a session</h2><p className="text-xs text-muted-foreground">{dashboard.total} session(s) found in the selected period.</p></div></div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {dashboard.sessions.map(session => (
                <Link key={session.session_uuid} href={sessionHref(fromDate, toDate, session.session_uuid)} className={`rounded-xl border p-3 text-sm transition hover:border-primary/50 ${detail?.session.session_uuid === session.session_uuid ? "border-primary bg-primary/10" : "border-border bg-background"}`}>
                  <span className="block font-black">{session.session_date}</span><span className="mt-1 block text-xs text-muted-foreground">{session.status} · {session.number_of_entries} entries</span><span className="mt-1 block truncate text-xs text-muted-foreground">{session.session_uuid}</span>
                </Link>
              ))}
            </div>
            {!dashboard.sessions.length ? <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No synchronized sessions in this period.</p> : null}
          </section>
        ) : null}
        {detail ? <div id="admin-editor" className="scroll-mt-4"><CoconutCountingAdminClient detail={detail} /></div> : null}
      </div>
    </DashboardShell>
  )
}
