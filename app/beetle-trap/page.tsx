import { Bug, Target, TriangleAlert, MapPin, CalendarClock, CircleCheck, Clock, CalendarDays, Info, type LucideIcon } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { StatCard } from "@/components/farm/stat-card"
import { ExportButton } from "@/components/farm/export-button"
import { BeetleTrapMapArea } from "@/components/beetle/beetle-trap-map-area"
import { BeetleDailyChart, type BeetleDailyCountRow } from "@/components/beetle/beetle-daily-chart"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"

export const dynamic = "force-dynamic"

type SummaryIcon = "trap" | "rhino" | "weevil" | "calendar" | "alert" | "area"
interface LiveTopTrap { trap_no: string; trap_type: string; cumulative_beetle_count: number; latest_inspection_date: string | null; latest_count: number; records_count: number }
interface LiveDailyCount { inspection_date: string; rhinoceros: number; red_palm_weevil: number; inspected_traps: number }
interface BeetleDashboardData {
  summary: { total_traps: number; rhinoceros_traps: number; red_palm_weevil_traps: number; highest_infection_trap: LiveTopTrap | null; latest_inspection: { inspection_date: string; inspected_traps: number; total_beetles: number } | null; next_inspection_date: string | null; inspection_interval_days: number }
  admin_settings: { cumulative_count_start_date: string | null; pheromone_lure_installed_date: string | null } | null
  daily_counts: LiveDailyCount[]
  top_traps: LiveTopTrap[]
  area_connected: boolean
  area_message: string
  pheromone_connected: boolean
  pheromone_message: string
}
interface SummaryCardItem { label: string; value: string; unit: string; icon: SummaryIcon }

const summaryIcon: Record<SummaryIcon, LucideIcon> = { trap: Target, rhino: Bug, weevil: Bug, calendar: CalendarClock, alert: TriangleAlert, area: MapPin }
const summaryAccent: Record<SummaryIcon, string> = { trap: "bg-primary/10 text-primary", rhino: "bg-foreground/10 text-foreground", weevil: "bg-destructive/10 text-destructive", calendar: "bg-chart-1/15 text-chart-1", alert: "bg-destructive/10 text-destructive", area: "bg-muted text-muted-foreground" }

async function getBeetleDashboardData(): Promise<BeetleDashboardData | null> {
  const authHeader = getBasicAuthHeader()
  if (!authHeader) return null
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/beetle-trap/dashboard`, { headers: { Authorization: authHeader, Accept: "application/json" }, cache: "no-store" })
    if (!response.ok) return null
    return (await response.json()) as BeetleDashboardData
  } catch { return null }
}
function parseDate(value: string | null | undefined): Date | null { if (!value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d }
function formatDisplayDate(value: string | null | undefined): string { const d = parseDate(value); if (!d) return "Not available"; return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(d) }
function daysUntil(value: string | null | undefined): string { const d = parseDate(value); if (!d) return "not connected"; const t = new Date(); const today = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()); const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); const diff = Math.round((target - today) / 86400000); if (diff === 0) return "due today"; if (diff > 0) return `in ${diff} day${diff === 1 ? "" : "s"}`; return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} overdue` }
function addMonths(value: string | null | undefined, months: number): string | null { const d = parseDate(value); if (!d) return null; const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate())); return next.toISOString().slice(0, 10) }
function summaryCards(data: BeetleDashboardData | null): SummaryCardItem[] {
  if (!data) return [
    { label: "Total Traps", value: "Unavailable", unit: "live API unavailable", icon: "trap" },
    { label: "Rhinoceros Beetle Traps", value: "Unavailable", unit: "live API unavailable", icon: "rhino" },
    { label: "Red Palm Weevil Traps", value: "Unavailable", unit: "live API unavailable", icon: "weevil" },
    { label: "Cumulative Count Start Date", value: "Unavailable", unit: "live API unavailable", icon: "calendar" },
    { label: "Next Pheromone Change Date", value: "Unavailable", unit: "live API unavailable", icon: "alert" },
    { label: "Highest Infection Area", value: "Not connected", unit: "area field needed", icon: "area" },
  ]
  const resetDate = data.admin_settings?.cumulative_count_start_date ?? null
  const pheromoneDate = data.admin_settings?.pheromone_lure_installed_date ?? resetDate
  const nextPheromoneDate = addMonths(pheromoneDate, 3)
  return [
    { label: "Total Traps", value: String(data.summary.total_traps), unit: "live locations", icon: "trap" },
    { label: "Rhinoceros Beetle Traps", value: String(data.summary.rhinoceros_traps), unit: "black beetle", icon: "rhino" },
    { label: "Red Palm Weevil Traps", value: String(data.summary.red_palm_weevil_traps), unit: "red beetle", icon: "weevil" },
    { label: "Cumulative Count Start Date", value: formatDisplayDate(resetDate), unit: "from latest admin setting", icon: "calendar" },
    { label: "Next Pheromone Change Date", value: formatDisplayDate(nextPheromoneDate), unit: pheromoneDate ? "3 months from install date" : "admin setting needed", icon: "alert" },
    { label: "Highest Infection Area", value: "Not connected", unit: "area/zone field needed", icon: "area" },
  ]
}
function dailyRows(data: BeetleDashboardData | null): BeetleDailyCountRow[] { return (data?.daily_counts ?? []).map((d) => ({ date: formatDisplayDate(d.inspection_date), rhinoceros: d.rhinoceros, redPalmWeevil: d.red_palm_weevil })) }
function NoticePanel({ title, message, icon: Icon }: { title: string; message: string; icon: LucideIcon }) { return <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground"><Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div><p className="font-semibold text-foreground">{title}</p><p>{message}</p></div></div> }

export default async function BeetleTrapPage() {
  const data = await getBeetleDashboardData()
  const cards = summaryCards(data)
  const rows = dailyRows(data)
  const latest = data?.summary.latest_inspection
  return <DashboardShell><div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5"><Header />
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bug className="size-6" aria-hidden="true" /></span><div><h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">Beetle Trap Monitoring</h1><p className="text-sm text-muted-foreground">Traps are inspected every 2 days</p></div></div><ExportButton /></div>
    {!data && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">Live Beetle Trap dashboard data is unavailable. Static values are not being shown as live data.</div>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{cards.map((s) => <StatCard key={s.label} icon={summaryIcon[s.icon]} label={s.label} value={s.value} sublabel={s.unit} accent={summaryAccent[s.icon]} />)}</div>
    <BeetleTrapMapArea />
    <Panel title="Daily Beetle Count – Last 15 Inspection Dates" icon={CalendarDays} headerRight={<span className="text-xs font-medium text-muted-foreground">Live from beetle_trap_counts</span>}><BeetleDailyChart counts={rows} /><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[420px] border-collapse text-sm"><thead><tr className="bg-primary/10 text-left text-xs font-semibold uppercase tracking-wide text-primary"><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5 text-right">Rhinoceros Beetle Count</th><th className="px-3 py-2.5 text-right">Red Palm Weevil Count</th></tr></thead><tbody>{rows.map((d) => <tr key={d.date} className="border-b border-border last:border-0 hover:bg-muted/50"><td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{d.date}</td><td className="px-3 py-2.5 text-right text-foreground">{d.rhinoceros}</td><td className="px-3 py-2.5 text-right text-foreground">{d.redPalmWeevil}</td></tr>)}{rows.length === 0 && <tr><td className="px-3 py-3 text-sm text-muted-foreground" colSpan={3}>No Beetle Count records are available yet.</td></tr>}</tbody></table></div></Panel>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2"><Panel title="Beetle Infection by Area" icon={MapPin}><NoticePanel title="Area data not connected yet." message={data?.area_message ?? "Area/zone field is not available in beetle_trap_locations yet."} icon={Info} /></Panel><Panel title="Recent Inspection Status" icon={CircleCheck}><div className="flex flex-col gap-4"><div className="flex items-start gap-3 rounded-lg border border-chart-2/30 bg-chart-2/10 p-3"><CircleCheck className="mt-0.5 size-5 shrink-0 text-chart-2" aria-hidden="true" /><div><p className="text-sm font-semibold text-foreground">Latest Beetle Count import date</p><p className="text-sm text-muted-foreground">{formatDisplayDate(latest?.inspection_date)} · {latest?.inspected_traps ?? 0} / {data?.summary.total_traps ?? 0} traps have count records for this date</p></div></div><div className="flex items-start gap-3 rounded-lg border border-chart-1/30 bg-chart-1/10 p-3"><Clock className="mt-0.5 size-5 shrink-0 text-chart-1" aria-hidden="true" /><div><p className="text-sm font-semibold text-foreground">Next inspection due</p><p className="text-sm text-muted-foreground">{formatDisplayDate(data?.summary.next_inspection_date)} · {daysUntil(data?.summary.next_inspection_date)}</p></div></div><div><div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium text-foreground">Latest-date traps with count records</span><span className="text-muted-foreground">{latest?.inspected_traps ?? 0} / {data?.summary.total_traps ?? 0}</span></div><div className="h-2.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-chart-2" style={{ width: `${data ? ((latest?.inspected_traps ?? 0) / data.summary.total_traps) * 100 : 0}%` }} /></div></div></div></Panel></div>
  </div></DashboardShell>
}