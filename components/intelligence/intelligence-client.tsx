"use client"

import { FormEvent, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, LoaderCircle, Send } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type TableCell = string | number | null | string[]
type TableColumn = { key: string; label: string; format: "integer" | "text" | "date" | "decimal6" | "flags" }
type ResultTable = { title: string; columns: TableColumn[]; rows: Array<Record<string, TableCell>> }
type ResultChart = { type: "line" | "bar"; x_field: string; y_fields: string[]; series_field: "plot" | "well" | null; rows: Array<Record<string, string | number | null>> }
type DomainName = "harvest" | "irrigation" | "well_water" | "beetle_monitoring"
type DomainSection = {
  domain: DomainName; title: string; headline: string; period: string | null; data_as_of: string;
  denominator: string | null; quality_flags: string[]; data_source_status: string;
  table: ResultTable | null; chart: ResultChart | null;
}
type ResultFreshness = {
  domains: Record<DomainName, string>; oldest_source_refresh: string;
  oldest_source_domain: DomainName; quality_flags: string[];
}
type PanelChart = ResultChart & { domain: DomainName; title: string }
type ActionableDenominators = {
  current_harvest_trees_considered: number; complete_five_cycle_history: number;
  incomplete_five_cycle_history: number; improved_count: number; declined_count: number;
  unchanged_count: number; lifecycle_as_of_date: string;
}

type IntelligenceResponse = {
  answer: string; status: string; data_as_of: string | null; period: string | null;
  period_start: string | null; period_end: string | null; cycles: string[];
  denominator: string | null; quality_flags: string[]; data_source_status: string;
  analysis_plan: Record<string, unknown> | null; table: ResultTable | null; chart: ResultChart | null;
  blocked_reason: string | null; metabase_call_made: boolean; provider_call_made: boolean;
  sections?: DomainSection[]; freshness?: ResultFreshness; charts?: PanelChart[];
  denominator_details?: ActionableDenominators; lifecycle_filter?: string; lifecycle_as_of_date?: string;
}

const examples = [
  "Average coconuts per harvested tree in the latest 10 completed harvest cycles",
  "Compare Plot 1 and Plot 2 for the latest 10 completed harvest cycles",
  "Top 10 coconut trees",
  "Show production trend for the last 10 harvests",
  "How is Tree 351 performing?",
  "Compare Tree 351 and Tree 281",
  "Show irrigation by zone for the latest 7 irrigation dates",
  "How much water was pumped from South Well on 16 August?",
  "Compare North and South Well readings",
  "How many beetles were caught on 17 August?",
  "Show Trap 12 history",
  "Show beetle-catch trend this month",
  "Give me a farm overview",
  "Show irrigation and well water for 16 August",
  "Show irrigation and beetle activity from 10 to 16 August",
  "Show irrigation, wells and beetle activity for the last 7 calendar days",
]

const EMPTY_FAILURE: IntelligenceResponse = {
  answer: "", status: "BLOCKED_NOT_YET_SUPPORTED", data_as_of: "", period: null,
  period_start: null, period_end: null, cycles: [], denominator: null, quality_flags: [],
  data_source_status: "NOT_QUERIED_FAIL_CLOSED", analysis_plan: null, table: null, chart: null,
  blocked_reason: "MFMS Intelligence is temporarily unavailable.", metabase_call_made: false,
  provider_call_made: false,
}

function renderCell(value: TableCell, format: TableColumn["format"]) {
  if (value === null) return "—"
  if (format === "integer" && typeof value === "number") return value.toLocaleString()
  if (format === "flags" && Array.isArray(value)) {
    if (value.length === 0) return "—"
    return <div className="max-w-64 space-y-1">{value.map((flag) => <div key={flag} className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900">{flag}</div>)}</div>
  }
  return String(value)
}

function GovernedChart({ chart, title = "Verified chart" }: { chart: ResultChart; title?: string }) {
  const normalizedRows = useMemo(() => chart.rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "string" && /^\d+\.\d+$/.test(value) ? Number(value) : value]))), [chart])
  const { rows, valueFields } = useMemo(() => {
    const seriesField = chart.series_field
    if (!seriesField) return { rows: normalizedRows, valueFields: chart.y_fields }
    const metric = chart.y_fields[0]
    const seriesValues = [...new Set(normalizedRows.map((row) => String(row[seriesField])))].sort()
    const byX = new Map<string, Record<string, unknown>>()
    for (const row of normalizedRows) {
      const xValue = String(row[chart.x_field]); const series = String(row[seriesField])
      const target = byX.get(xValue) ?? { [chart.x_field]: row[chart.x_field] }
      target[series] = row[metric]; byX.set(xValue, target)
    }
    return { rows: [...byX.values()], valueFields: seriesValues }
  }, [chart, normalizedRows])
  const colors = ["#15803d", "#2563eb", "#b45309"]
  return <div className="mt-5 rounded-xl border border-border p-3">
    <h3 className="mb-3 text-sm font-semibold">{title}</h3>
    <div className="h-72 w-full" aria-label="Deterministic verified analytics result chart">
      <ResponsiveContainer width="100%" height="100%">
        {chart.type === "line" ? <LineChart data={rows} margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={chart.x_field} /><YAxis /><Tooltip /><Legend />
          {valueFields.map((field, index) => <Line key={field} type="monotone" dataKey={field} stroke={colors[index % colors.length]} strokeWidth={2} dot />)}
        </LineChart> : <BarChart data={rows} margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={chart.x_field} /><YAxis /><Tooltip /><Legend />
          {valueFields.map((field, index) => <Bar key={field} dataKey={field} fill={colors[index % colors.length]} />)}
        </BarChart>}
      </ResponsiveContainer>
    </div>
  </div>
}

function GovernedTable({ table }: { table: ResultTable }) {
  return <div className="mt-5 overflow-x-auto rounded-xl border border-border">
    <table className="min-w-[760px] w-full border-collapse text-left text-sm">
      <caption className="px-3 py-3 text-left text-sm font-semibold">{table.title}</caption>
      <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground"><tr>{table.columns.map((column) => <th key={column.key} className={`px-3 py-3 font-semibold ${["integer", "decimal6"].includes(column.format) ? "text-right" : "text-left"}`}>{column.label}</th>)}</tr></thead>
      <tbody className="divide-y divide-border">{table.rows.map((row, rowIndex) => <tr key={`${rowIndex}-${String(row.date ?? row.tree_no ?? row.cycle ?? row.plot ?? "result")}`} className="bg-background align-top">
        {table.columns.map((column) => <td key={column.key} className={`px-3 py-3 ${["integer", "decimal6"].includes(column.format) ? "text-right tabular-nums" : "text-left"} ${column.key === "tree_no" ? "font-mono font-semibold" : ""}`}>{renderCell(row[column.key], column.format)}</td>)}
      </tr>)}</tbody>
    </table>
  </div>
}

function DomainCard({ section }: { section: DomainSection }) {
  return <article className="rounded-xl border border-border bg-background p-4">
    <h3 className="font-bold">{section.title}</h3>
    <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{section.headline}</p>
    <dl className="mt-4 grid gap-2 text-xs text-muted-foreground">
      <div><dt className="font-semibold text-foreground">Period</dt><dd>{section.period ?? "Domain default"}</dd></div>
      <div><dt className="font-semibold text-foreground">Latest data</dt><dd>{section.data_as_of}</dd></div>
      {section.denominator && <div><dt className="font-semibold text-foreground">Denominator</dt><dd>{section.denominator}</dd></div>}
      <div><dt className="font-semibold text-foreground">Source status</dt><dd className="break-words">{section.data_source_status}</dd></div>
    </dl>
    {section.quality_flags.length > 0 && <div className="mt-3 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-950"><span className="font-semibold">Quality: </span>{section.quality_flags.join(", ")}</div>}
    {(section.table || section.chart) && <details className="mt-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">Open verified details</summary>
      {section.table && <GovernedTable table={section.table} />}
      {section.chart && <GovernedChart chart={section.chart} title={`${section.title} — verified chart`} />}
    </details>}
  </article>
}

export function IntelligenceClient() {
  const [question, setQuestion] = useState(examples[0])
  const [result, setResult] = useState<IntelligenceResponse | null>(null)
  const [loading, setLoading] = useState(false)

  async function ask(event: FormEvent) {
    event.preventDefault()
    if (!question.trim() || loading) return
    setLoading(true); setResult(null)
    try {
      const response = await fetch("/api/intelligence/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      })
      setResult((await response.json()) as IntelligenceResponse)
    } catch { setResult(EMPTY_FAILURE) } finally { setLoading(false) }
  }

  const answered = result?.status === "ANSWERED"
  return <div className="space-y-5">
    <form onSubmit={ask} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <label htmlFor="intelligence-question" className="mb-2 block text-sm font-semibold">Ask a verified farm analytics question</label>
      <textarea id="intelligence-question" value={question} onChange={(event) => setQuestion(event.target.value.slice(0, 500))} maxLength={500} rows={4} className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none ring-primary/30 focus:ring-4" placeholder="Ask about harvest, irrigation, wells, or descriptive beetle monitoring" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{question.length}/500 characters</span>
        <button type="submit" disabled={loading || !question.trim()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{loading ? "Checking governed data…" : "Ask"}
        </button>
      </div>
    </form>

    <section aria-label="Example questions" className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-sm font-semibold">Try a verified question</h2>
      <div className="mt-3 flex flex-wrap gap-2">{examples.map((example) => <button key={example} type="button" onClick={() => setQuestion(example)} className="rounded-full border border-border bg-muted px-3 py-2 text-left text-xs hover:bg-primary/10">{example}</button>)}</div>
      <p className="mt-3 text-xs text-muted-foreground">Historical lifecycle reconstruction, per-tree irrigation, missed-harvest, revenue, recharge, sufficiency, forecasting, causal, trap-effectiveness, placement, and treatment recommendations remain blocked.</p>
    </section>

    {result && <section aria-live="polite" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">{answered ? <CheckCircle2 className="size-5 text-emerald-600" /> : <AlertTriangle className="size-5 text-amber-600" />}<h2 className="font-bold">{answered ? "Verified answer" : "Blocked or clarification required"}</h2></div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{result.answer || result.blocked_reason}</p>

      {result.sections && result.sections.length > 0 && <div className="mt-5 grid gap-4 lg:grid-cols-2">{result.sections.map((section) => <DomainCard key={section.domain} section={section} />)}</div>}
      {result.table && <GovernedTable table={result.table} />}
      {result.chart && <GovernedChart chart={result.chart} />}
      {result.charts && result.charts.length > 0 && <div className="mt-5 space-y-4" aria-label="Independent cross-domain chart panels">{result.charts.map(({ domain, title, ...chart }) => <GovernedChart key={`${domain}-${title}`} chart={chart} title={title} />)}</div>}

      {result.freshness && <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold">Freshness by domain</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{Object.entries(result.freshness.domains).map(([domain, timestamp]) => <div key={domain}><dt className="font-semibold">{domain.replaceAll("_", " ")}</dt><dd>{timestamp}</dd></div>)}</dl>
        <p className="mt-3 text-xs text-muted-foreground">Oldest source refresh: {result.freshness.oldest_source_refresh} ({result.freshness.oldest_source_domain.replaceAll("_", " ")})</p>
        {result.freshness.quality_flags.includes("DATA_FRESHNESS_DIFFERS_BY_DOMAIN") && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-950">Data freshness differs by domain.</p>}
      </div>}

      <div className="mt-5 rounded-xl bg-muted/50 p-4">
        <h3 className="text-sm font-semibold">Verification</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {result.data_as_of && !result.freshness && <div><dt className="font-semibold">Data as of</dt><dd>{result.data_as_of}</dd></div>}
          {result.period && <div><dt className="font-semibold">Period</dt><dd>{result.period}</dd></div>}
          {(result.period_start || result.period_end) && <div><dt className="font-semibold">Dates</dt><dd>{result.period_start ?? "—"} to {result.period_end ?? "—"}</dd></div>}
          {result.cycles.length > 0 && <div><dt className="font-semibold">Cycles</dt><dd>{result.cycles.join(", ")}</dd></div>}
          {result.denominator && <div><dt className="font-semibold">Denominator</dt><dd>{result.denominator}</dd></div>}
          {result.lifecycle_filter && <div><dt className="font-semibold">Lifecycle filter</dt><dd>{result.lifecycle_filter}</dd></div>}
          {result.lifecycle_as_of_date && <div><dt className="font-semibold">Lifecycle as of</dt><dd>{result.lifecycle_as_of_date}</dd></div>}
          <div><dt className="font-semibold">Data source status</dt><dd className="break-words">{result.data_source_status}</dd></div>
        </dl>
        {result.denominator_details && <dl className="mt-4 grid gap-2 border-t border-border pt-4 text-sm sm:grid-cols-3">
          <div><dt className="font-semibold">Current Harvest Trees considered</dt><dd>{result.denominator_details.current_harvest_trees_considered.toLocaleString()}</dd></div>
          <div><dt className="font-semibold">Complete five-cycle history</dt><dd>{result.denominator_details.complete_five_cycle_history.toLocaleString()}</dd></div>
          <div><dt className="font-semibold">Excluded for incomplete history</dt><dd>{result.denominator_details.incomplete_five_cycle_history.toLocaleString()}</dd></div>
          <div><dt className="font-semibold">Improved</dt><dd>{result.denominator_details.improved_count.toLocaleString()}</dd></div>
          <div><dt className="font-semibold">Declined</dt><dd>{result.denominator_details.declined_count.toLocaleString()}</dd></div>
          <div><dt className="font-semibold">Unchanged</dt><dd>{result.denominator_details.unchanged_count.toLocaleString()}</dd></div>
        </dl>}
      </div>
      {result.quality_flags.length > 0 && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-950"><span className="font-semibold">Quality flags: </span>{result.quality_flags.join(", ")}</div>}
    </section>}
  </div>
}
