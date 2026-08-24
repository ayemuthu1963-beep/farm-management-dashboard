"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  CircleHelp,
  Database,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"
import type { AiGenerationResult, AnalyzerAlert, AnalyzerResponse, AnalyzerSeverity } from "@/lib/ai-analyzer-types"
import {
  filterAnalyzerAlerts,
  resolveVisibleAnalyzerAlert,
  type AnalyzerFilterState,
} from "@/lib/ai-analyzer-filtering"
import { cn } from "@/lib/utils"

const INITIAL_FILTERS: AnalyzerFilterState = { crop: "all", plot: "all", zone: "all", date: "", severity: "all" }

const severityStyle: Record<AnalyzerSeverity, string> = {
  critical: "border-red-300 bg-red-50 text-red-900",
  warning: "border-amber-300 bg-amber-50 text-amber-950",
  information: "border-sky-300 bg-sky-50 text-sky-950",
}

function displayName(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
}

function displayTimestamp(value: string | null) {
  if (!value) return "Unavailable"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })
}

function statusLabel(status: AnalyzerResponse["farm_status"]) {
  return {
    normal: "Normal",
    attention: "Attention required",
    critical: "Critical evidence present",
    data_incomplete: "Data incomplete",
  }[status]
}

function StatusIcon({ status }: { status: AnalyzerResponse["farm_status"] }) {
  if (status === "normal") return <CheckCircle2 className="size-6 text-emerald-700" aria-hidden="true" />
  if (status === "critical") return <AlertCircle className="size-6 text-red-700" aria-hidden="true" />
  if (status === "attention") return <AlertTriangle className="size-6 text-amber-700" aria-hidden="true" />
  return <CircleHelp className="size-6 text-sky-700" aria-hidden="true" />
}

function AlertCard({ alert, selected, onSelect }: { alert: AnalyzerAlert; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} aria-pressed={selected} className={cn("w-full rounded-xl border p-4 text-left transition", severityStyle[alert.severity], selected ? "ring-2 ring-primary ring-offset-2" : "hover:shadow-sm")}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide">{alert.severity}</span>
      <span className="font-mono text-[10px] opacity-75">{alert.rule_id} · v{alert.rule_version}</span>
    </div>
    <h3 className="mt-3 font-bold leading-snug">{alert.title}</h3>
    <p className="mt-2 text-xs opacity-80">{[alert.crop, alert.plot, alert.zone, alert.tree && `Tree ${alert.tree}`].filter(Boolean).join(" · ") || "Farm-wide"}</p>
    <p className="mt-1 text-xs opacity-80">{alert.start_date ?? "No start date"}{alert.end_date && alert.end_date !== alert.start_date ? ` to ${alert.end_date}` : ""}</p>
  </button>
}

function EvidencePanel({
  alert,
  aiEnabled,
  generating,
  generationStatus,
  onGenerate,
}: {
  alert: AnalyzerAlert
  aiEnabled: boolean
  generating: boolean
  generationStatus: string | null
  onGenerate: () => void
}) {
  const explanation = alert.ai_explanation ?? alert.deterministic_fallback_explanation
  const explanationIsAi = Boolean(alert.ai_explanation)
  return <article className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide", severityStyle[alert.severity])}>{alert.severity}</span>
        <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase">Confidence: {alert.confidence}</span>
        <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase">Data: {displayName(alert.data_completeness_status)}</span>
      </div>
      <h2 className="mt-3 text-xl font-extrabold">{alert.title}</h2>
      <p className="mt-2 font-mono text-xs text-muted-foreground">Alert {alert.alert_id}</p>
    </div>

    <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4" aria-labelledby="deterministic-evidence-heading">
      <div className="flex items-center gap-2 text-emerald-950"><ShieldCheck className="size-5" aria-hidden="true" /><h3 id="deterministic-evidence-heading" className="font-bold">Deterministic evidence</h3></div>
      <p className="mt-3 text-sm leading-6 text-emerald-950"><span className="font-semibold">Triggered when: </span>{alert.deterministic_condition}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {alert.evidence_values.map((evidence) => <div key={`${evidence.source_name}-${evidence.name}`} className="rounded-lg border border-emerald-200 bg-white/80 p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">{displayName(evidence.name)}</dt>
          <dd className="mt-1 text-lg font-extrabold text-emerald-950">{evidence.value === null ? "Unavailable" : String(evidence.value)} <span className="text-xs font-medium">{evidence.unit}</span></dd>
          <dd className="mt-1 text-[10px] text-emerald-800">Source: {displayName(evidence.source_name)}</dd>
        </div>)}
      </dl>
      <div className="mt-4 space-y-2 text-xs text-emerald-950">
        {alert.source_records.map((source) => <div key={source.source_name} className="rounded-lg bg-white/70 p-2"><span className="font-semibold">{displayName(source.source_name)}</span> · data as of {displayTimestamp(source.source_timestamp)}{source.record_ids.length > 0 ? ` · source records ${source.record_ids.join(", ")}` : ""}</div>)}
      </div>
    </section>

    <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-4" aria-labelledby="explanation-heading">
      <div className="flex items-center gap-2 text-violet-950">{explanationIsAi ? <Bot className="size-5" aria-hidden="true" /> : <FileSearch className="size-5" aria-hidden="true" />}<h3 id="explanation-heading" className="font-bold">{explanationIsAi ? "AI explanation" : "Deterministic fallback explanation"}</h3></div>
      <p className="mt-3 text-sm leading-6 text-violet-950">{explanation}</p>
      <p className="mt-3 text-[11px] text-violet-800">{explanationIsAi ? `Model ${alert.model_name} · prompt ${alert.prompt_version}${alert.ai_usage?.cache_hit ? " · evidence-cache hit" : ""}` : "AI was disabled, unavailable, over its limit, or safely rejected. The Analyzer remains functional."}</p>
      {!explanationIsAi ? <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!aiEnabled || generating}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-900 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Bot className="size-4" aria-hidden="true" />}
          {generating ? "Generating…" : "Generate AI explanation"}
        </button>
        <span className="text-xs font-semibold text-violet-800">{aiEnabled ? "On demand for this alert only" : "Live AI unavailable — deterministic fallback remains active"}</span>
      </div> : null}
      {generationStatus ? <p role="status" className="mt-3 text-xs font-semibold text-violet-900">{generationStatus}</p> : null}
    </section>

    <section className="rounded-xl border border-border bg-muted/30 p-4" aria-labelledby="checks-heading">
      <h3 id="checks-heading" className="font-bold">Suggested field checks</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">{alert.suggested_field_checks.map((check) => <li key={check}>{check}</li>)}</ul>
      <p className="mt-4 text-xs font-semibold text-muted-foreground">Advisory checks only. This page cannot operate irrigation, motors, wells, or fertiliser equipment and cannot change farm records.</p>
    </section>
  </article>
}

export function AiAnalyzerClient() {
  const [data, setData] = useState<AnalyzerResponse | null>(null)
  const [filters, setFilters] = useState<AnalyzerFilterState>(INITIAL_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [generationStatus, setGenerationStatus] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/ai-analyzer?refresh=${Date.now()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null) as AnalyzerResponse | { error?: string } | null
      if (!response.ok || !payload || !("alerts" in payload)) throw new Error(payload && "error" in payload ? payload.error : "AI Farm Analyzer is unavailable.")
      setData(payload)
      setSelectedId((current) => payload.alerts.some((alert) => alert.alert_id === current) ? current : payload.alerts[0]?.alert_id ?? null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI Farm Analyzer is unavailable.")
    } finally {
      setLoading(false)
    }
  }, [])

  const generateExplanation = useCallback(async (alert: AnalyzerAlert) => {
    if (!data?.ai_enabled || generatingId) return
    setGeneratingId(alert.alert_id)
    setGenerationStatus(null)
    try {
      const response = await fetch("/api/ai-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_id: alert.alert_id, evidence_hash: alert.evidence_hash }),
        cache: "no-store",
      })
      const payload = await response.json().catch(() => null) as AiGenerationResult | { error?: string } | null
      if (!response.ok || !payload || !("alert" in payload)) {
        throw new Error(payload && "error" in payload ? payload.error : "AI explanation is unavailable.")
      }
      setData((current) => current ? {
        ...current,
        alerts: current.alerts.map((item) => item.alert_id === payload.alert.alert_id ? payload.alert : item),
      } : current)
      setGenerationStatus(payload.status === "cache_hit" ? "Validated explanation loaded from the evidence cache; no provider call was made." : payload.status === "generated" ? "Validated AI explanation generated for this alert." : "Deterministic fallback remains active.")
    } catch (reason) {
      setGenerationStatus(reason instanceof Error ? reason.message : "AI explanation is unavailable; deterministic fallback remains active.")
    } finally {
      setGeneratingId(null)
    }
  }, [data?.ai_enabled, generatingId])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(initialLoad)
  }, [refresh])

  const options = useMemo(() => ({
    crops: [...new Set(data?.alerts.map((alert) => alert.crop).filter((value): value is string => Boolean(value)) ?? [])].sort(),
    plots: [...new Set(data?.alerts.map((alert) => alert.plot).filter((value): value is string => Boolean(value)) ?? [])].sort(),
    zones: [...new Set(data?.alerts.map((alert) => alert.zone).filter((value): value is string => Boolean(value)) ?? [])].sort(),
  }), [data])

  const updateFilter = useCallback(<Key extends keyof AnalyzerFilterState,>(key: Key, value: AnalyzerFilterState[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setSelectedId(null)
    setGenerationStatus(null)
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS)
    setSelectedId(null)
    setGenerationStatus(null)
  }, [])

  const visibleAlerts = useMemo(() => filterAnalyzerAlerts(data?.alerts ?? [], filters), [data, filters])

  const selected = resolveVisibleAnalyzerAlert(visibleAlerts, selectedId)

  if (!data && loading) return <div className="flex min-h-80 items-center justify-center gap-3 rounded-2xl border border-border bg-card"><LoaderCircle className="size-6 animate-spin text-primary" aria-hidden="true" /><span className="font-semibold">Reading deterministic farm evidence…</span></div>
  if (!data) return <div className="rounded-2xl border border-red-300 bg-red-50 p-6 text-red-950"><h2 className="font-bold">Analyzer unavailable</h2><p className="mt-2 text-sm">{error}</p><button type="button" onClick={() => void refresh()} className="mt-4 rounded-lg bg-red-900 px-4 py-2 text-sm font-semibold text-white">Try again</button></div>

  return <div className="space-y-5">
    {error ? <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">Refresh failed; the last validated result remains visible. {error}</div> : null}

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.6fr))]" aria-label="Farm status and alert counts">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><StatusIcon status={data.farm_status} /><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Overall farm status</p><p className="mt-1 text-xl font-extrabold">{statusLabel(data.farm_status)}</p></div></div><button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold disabled:opacity-50"><RefreshCw className={cn("size-4", loading && "animate-spin")} />Refresh</button></div>
        <p className="mt-4 text-xs text-muted-foreground">Generated {displayTimestamp(data.generated_at)} · deterministic rules {data.deterministic_rules_version} · read-only</p>
      </div>
      {(["critical", "warning", "information"] as const).map((severity) => <div key={severity} className={cn("rounded-2xl border p-5", severityStyle[severity])}><p className="text-xs font-extrabold uppercase tracking-wide">{severity}</p><p className="mt-2 text-3xl font-black tabular-nums">{data.alert_counts[severity]}</p></div>)}
    </section>

    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="source-freshness-heading">
      <div className="flex items-center gap-2"><Database className="size-5 text-primary" aria-hidden="true" /><h2 id="source-freshness-heading" className="font-bold">Data as of — every source</h2></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.sources.map((source) => <div key={source.source_name} className="rounded-xl border border-border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">{displayName(source.source_name)}</p><span className={cn("rounded-full px-2 py-1 text-[9px] font-extrabold uppercase", source.completeness_status === "complete" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>{displayName(source.completeness_status)}</span></div>
        <p className="mt-2 text-xs text-muted-foreground">{displayTimestamp(source.source_timestamp)}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Period: {source.data_period_start ?? "—"} to {source.data_period_end ?? "—"}</p>
        {source.missing_data_warnings.map((warning) => <p key={warning} className="mt-2 rounded bg-amber-50 p-2 text-[10px] font-medium text-amber-950">{warning}</p>)}
      </div>)}</div>
    </section>

    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm" aria-labelledby="analyzer-filters-heading">
      <h2 id="analyzer-filters-heading" className="text-sm font-bold">Alert filters</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-semibold">Crop<select value={filters.crop} onChange={(event) => updateFilter("crop", event.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"><option value="all">All crops</option>{options.crops.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs font-semibold">Plot<select value={filters.plot} onChange={(event) => updateFilter("plot", event.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"><option value="all">All plots</option>{options.plots.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs font-semibold">Zone<select value={filters.zone} onChange={(event) => updateFilter("zone", event.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"><option value="all">All zones</option>{options.zones.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs font-semibold">Severity<select value={filters.severity} onChange={(event) => updateFilter("severity", event.target.value as AnalyzerFilterState["severity"])} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="information">Information</option></select></label>
        <label className="text-xs font-semibold">Date<input type="date" value={filters.date} onInput={(event) => updateFilter("date", event.currentTarget.value)} onChange={(event) => updateFilter("date", event.currentTarget.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Date uses the Asia/Kolkata farm calendar and matches structured alert dates inclusively. Alerts without a structured date are excluded while Date is active.</p>
      <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{visibleAlerts.length} of {data.alerts.length} alerts</p><button type="button" onClick={clearFilters} className="text-xs font-bold text-primary">Clear filters</button></div>
    </section>

    <section className="grid items-start gap-5 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.7fr)]" aria-label="Alert list and evidence">
      <div className="space-y-3">{visibleAlerts.map((alert) => <AlertCard key={alert.alert_id} alert={alert} selected={selected?.alert_id === alert.alert_id} onSelect={() => { setSelectedId(alert.alert_id); setGenerationStatus(null) }} />)}{visibleAlerts.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">No alerts match the selected filters.</div> : null}</div>
      {selected ? <EvidencePanel alert={selected} aiEnabled={data.ai_enabled} generating={generatingId === selected.alert_id} generationStatus={generationStatus} onGenerate={() => void generateExplanation(selected)} /> : <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Select an alert to inspect its evidence.</div>}
    </section>

    <section className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
      <div className="flex items-center gap-2"><BrainCircuit className="size-5" aria-hidden="true" /><h2 className="font-bold">Two-layer safety design</h2></div>
      <p className="mt-2 leading-6">All queries, calculations, thresholds, and alert decisions are deterministic. The optional AI layer receives only the compact calculated evidence for an alert and can provide an explanation and advisory field checks. It has no database access or control actions.</p>
    </section>
  </div>
}
