"use client"

import { FormEvent, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, LoaderCircle, Send } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type TableCell = string | number | null | string[]
type TableColumn = { key: string; label: string; format: "integer" | "text" | "date" | "decimal6" | "flags" }
type ResultTable = { title: string; columns: TableColumn[]; rows: Array<Record<string, TableCell>> }
type ResultChart = { type: "line" | "bar"; x_field: string; y_fields: string[]; series_field: "plot" | "well" | null; rows: Array<Record<string, string | number | null>> }

type IntelligenceResponse = {
  answer: string; status: string; data_as_of: string; period: string | null;
  period_start: string | null; period_end: string | null; cycles: string[];
  denominator: string | null; quality_flags: string[]; data_source_status: string;
  analysis_plan: Record<string, unknown> | null; table: ResultTable | null; chart: ResultChart | null;
  blocked_reason: string | null; metabase_call_made: boolean; provider_call_made: boolean;
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

function GovernedChart({ chart }: { chart: ResultChart }) {
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
    <h3 className="mb-3 text-sm font-semibold">Verified chart</h3>
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
      <textarea id="intelligence-question" value={question} onChange={(event) => setQuestion(event.target.value.slice(0, 500))} maxLength={500} rows={4} className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none ring-primary/30 focus:ring-4" placeholder="Ask about harvest, irrigation runtime and delivered water, or North/South Well readings" />
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
      <p className="mt-3 text-xs text-muted-foreground">Eligible-tree, per-tree irrigation, missed-harvest, revenue, recharge, sufficiency, forecasting, causal, and recommendation metrics remain blocked.</p>
    </section>

    {result && <section aria-live="polite" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">{answered ? <CheckCircle2 className="size-5 text-emerald-600" /> : <AlertTriangle className="size-5 text-amber-600" />}<h2 className="font-bold">{answered ? "Verified answer" : "Blocked or clarification required"}</h2></div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{result.answer || result.blocked_reason}</p>

      {result.table && <div className="mt-5 overflow-x-auto rounded-xl border border-border">
        <table className="min-w-[760px] w-full border-collapse text-left text-sm">
          <caption className="px-3 py-3 text-left text-sm font-semibold">{result.table.title}</caption>
          <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground"><tr>{result.table.columns.map((column) => <th key={column.key} className={`px-3 py-3 font-semibold ${["integer", "decimal6"].includes(column.format) ? "text-right" : "text-left"}`}>{column.label}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">{result.table.rows.map((row, rowIndex) => <tr key={`${rowIndex}-${String(row.tree_no ?? row.cycle ?? row.plot ?? "result")}`} className="bg-background align-top">
            {result.table!.columns.map((column) => <td key={column.key} className={`px-3 py-3 ${["integer", "decimal6"].includes(column.format) ? "text-right tabular-nums" : "text-left"} ${column.key === "tree_no" ? "font-mono font-semibold" : ""}`}>{renderCell(row[column.key], column.format)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>}
      {result.chart && <GovernedChart chart={result.chart} />}

      <div className="mt-5 rounded-xl bg-muted/50 p-4">
        <h3 className="text-sm font-semibold">Verification</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {result.data_as_of && <div><dt className="font-semibold">Data as of</dt><dd>{result.data_as_of}</dd></div>}
          {result.period && <div><dt className="font-semibold">Period</dt><dd>{result.period}</dd></div>}
          {(result.period_start || result.period_end) && <div><dt className="font-semibold">Dates</dt><dd>{result.period_start ?? "—"} to {result.period_end ?? "—"}</dd></div>}
          {result.cycles.length > 0 && <div><dt className="font-semibold">Cycles</dt><dd>{result.cycles.join(", ")}</dd></div>}
          {result.denominator && <div><dt className="font-semibold">Denominator</dt><dd>{result.denominator}</dd></div>}
          <div><dt className="font-semibold">Data source status</dt><dd className="break-words">{result.data_source_status}</dd></div>
        </dl>
      </div>
      {result.quality_flags.length > 0 && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-950"><span className="font-semibold">Quality flags: </span>{result.quality_flags.join(", ")}</div>}
    </section>}
  </div>
}
