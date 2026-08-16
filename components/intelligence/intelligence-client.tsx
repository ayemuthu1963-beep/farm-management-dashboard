"use client"

import { FormEvent, useState } from "react"
import { AlertTriangle, CheckCircle2, LoaderCircle, Send } from "lucide-react"

type IntelligenceResponse = {
  answer: string; status: string; data_as_of: string | null; period: string | null;
  cycles: Array<string | number>; denominator: string | null; quality_flags: string[];
  blocked_reason: string | null; metabase_call_made: boolean; provider_call_made: boolean;
}

const examples = [
  "Average coconuts per harvested tree in the latest 10 completed harvest cycles",
  "Compare Plot 1 and Plot 2 for the latest 10 completed harvest cycles",
  "Show Tree 1112 harvest history",
]

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
    } catch {
      setResult({ answer: "", status: "failed_closed", data_as_of: null, period: null, cycles: [], denominator: null, quality_flags: [], blocked_reason: "MFMS Intelligence is temporarily unavailable.", metabase_call_made: false, provider_call_made: false })
    } finally { setLoading(false) }
  }

  const answered = result?.status === "ANSWERED"
  return <div className="space-y-5">
    <form onSubmit={ask} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <label htmlFor="intelligence-question" className="mb-2 block text-sm font-semibold">Ask a verified harvest analytics question</label>
      <textarea id="intelligence-question" value={question} onChange={(event) => setQuestion(event.target.value.slice(0, 500))} maxLength={500} rows={4} className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none ring-primary/30 focus:ring-4" placeholder="Ask about completed harvest cycles, plots, or observed tree history" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{question.length}/500 characters</span>
        <button type="submit" disabled={loading || !question.trim()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{loading ? "Checking governed data…" : "Ask"}
        </button>
      </div>
    </form>
    <section aria-label="Example questions" className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-sm font-semibold">Verified examples</h2>
      <div className="mt-3 flex flex-wrap gap-2">{examples.map((example) => <button key={example} type="button" onClick={() => setQuestion(example)} className="rounded-full border border-border bg-muted px-3 py-2 text-left text-xs hover:bg-primary/10">{example}</button>)}</div>
      <p className="mt-3 text-xs text-muted-foreground">Eligible-tree, missed-harvest, classification, previous-10, causal irrigation, and beetle recommendation metrics remain blocked.</p>
    </section>
    {result && <section aria-live="polite" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">{answered ? <CheckCircle2 className="size-5 text-emerald-600" /> : <AlertTriangle className="size-5 text-amber-600" />}<h2 className="font-bold">{answered ? "Verified answer" : "Blocked or unavailable"}</h2></div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{result.answer || result.blocked_reason}</p>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        {result.data_as_of && <div><dt className="font-semibold">Data as of</dt><dd>{result.data_as_of}</dd></div>}
        {result.period && <div><dt className="font-semibold">Period</dt><dd>{result.period}</dd></div>}
        {result.cycles.length > 0 && <div><dt className="font-semibold">Cycles</dt><dd>{result.cycles.join(", ")}</dd></div>}
        {result.denominator && <div><dt className="font-semibold">Denominator</dt><dd>{result.denominator}</dd></div>}
      </dl>
      {result.quality_flags.length > 0 && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-950"><span className="font-semibold">Quality flags: </span>{result.quality_flags.join(", ")}</div>}
    </section>}
  </div>
}
