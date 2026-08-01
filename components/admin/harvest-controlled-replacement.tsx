"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Download, RefreshCw, ShieldCheck } from "lucide-react"
import { formatIstDateTime } from "@/lib/format-ist-date-time"

interface HarvestValues {
  harvestRecordId?: number | null
  treeNo: string
  harvestDate: string
  harvestCycle?: number | string | null
  b1: number | null
  b2: number | null
  b3: number | null
  totalBunches: number
  totalNuts: number
  odkInstanceId?: string | null
  source?: string | null
}

interface CycleTotals {
  records?: number | null
  trees: number
  bunches: number
  nuts: number
}

interface ReplacementRun {
  runId: number
  status: string
  appliedAt?: string | null
  appliedBy?: string | null
  auditCsvSha256?: string | null
  before?: HarvestValues | null
  after?: HarvestValues | null
  delta?: CycleTotals | null
  cycleTotalsBefore?: CycleTotals | null
  projectedCycleTotals?: CycleTotals | null
  cycleTotalsAfter?: CycleTotals | null
  auditCsvUrl?: string | null
  supervisorAction?: string | null
  supervisorReason?: string | null
  supervisor?: string | null
  decisionTimestamp?: string | null
}

interface ReplacementProposal {
  eligible: boolean
  status: "CORRECTION_REQUIRED" | "CORRECTION_APPLIED" | string
  manualCorrectionEnabled?: boolean
  cycleOpen: boolean
  existingRecordFingerprintCurrent: boolean
  pendingGroupFingerprintCurrent: boolean
  decision: {
    id: number
    action: string
    reason: string
    supervisor: string
    decidedAt: string | null
  }
  existingRecord: HarvestValues
  pendingSubmission: HarvestValues
  delta: CycleTotals
  cycleTotalsBefore: CycleTotals
  projectedCycleTotals: CycleTotals
  existingRecordFingerprint: string
  pendingGroupFingerprint: string
  pendingCycleSourceFingerprint: string
  confirmationPhrase: string
  latestRun?: ReplacementRun | null
}

interface ReplacementDryRun {
  status: string
  transactionRolledBack: boolean
  hostLockVerified: boolean
  postgresAdvisoryLockVerified: boolean
  dryRunAt: string | null
  auditRowsGenerated: number
  dryRunToken: string
  tokenExpiresAt: string | null
  before: HarvestValues
  after: HarvestValues
  delta: CycleTotals
  projectedCycleTotals: CycleTotals
}

interface Props {
  scanId: number
  harvestDate: string
  harvestCycle: number | string
  treeNo: string
  existingHarvestRecordId: number | null
  pendingOdkInstanceId: string
  disabled?: boolean
  onReplacementApplied: () => Promise<void>
}

function numberText(value: number | null | undefined, signed = false): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—"
  if (signed && value > 0) return `+${value.toLocaleString("en-IN")}`
  return value.toLocaleString("en-IN")
}

function displayDate(value: string | null | undefined): string {
  if (!value) return "—"
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`)
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function errorMessage(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") return fallback
  const record = value as Record<string, unknown>
  for (const key of ["detail", "error", "message"]) {
    if (typeof record[key] === "string" && record[key]) return record[key]
  }
  return fallback
}

function normalizeRun(value: Record<string, unknown>): ReplacementRun {
  return {
    runId: Number(value.runId ?? value.correctionRunId),
    status: String(value.status ?? ""),
    appliedAt: (value.appliedAt ?? value.appliedTimestamp ?? null) as string | null,
    appliedBy: (value.appliedBy ?? value.appliedUser ?? null) as string | null,
    auditCsvSha256: (value.auditCsvSha256 ?? null) as string | null,
    auditCsvUrl: (value.auditCsvUrl ?? null) as string | null,
    before: (value.before ?? value.beforeValues ?? null) as HarvestValues | null,
    after: (value.after ?? value.afterValues ?? null) as HarvestValues | null,
    delta: (value.delta ?? value.cycleTotalDelta ?? null) as CycleTotals | null,
    cycleTotalsBefore: (value.cycleTotalsBefore ?? null) as CycleTotals | null,
    projectedCycleTotals: (value.projectedCycleTotals ?? null) as CycleTotals | null,
    cycleTotalsAfter: (value.cycleTotalsAfter ?? null) as CycleTotals | null,
    supervisorAction: (value.supervisorAction ?? null) as string | null,
    supervisorReason: (value.supervisorReason ?? null) as string | null,
    supervisor: (value.supervisor ?? null) as string | null,
    decisionTimestamp: (value.decisionTimestamp ?? null) as string | null,
  }
}

function normalizeProposal(value: Record<string, unknown>): ReplacementProposal {
  const latestRunValue = value.latestRun
  const latestRun =
    latestRunValue && typeof latestRunValue === "object"
      ? normalizeRun(latestRunValue as Record<string, unknown>)
      : null
  const applied = value.status === "CORRECTION_APPLIED" ? latestRun : null
  return {
    ...(value as unknown as ReplacementProposal),
    manualCorrectionEnabled: value.manualCorrectionEnabled === true,
    cycleOpen: value.cycleOpen === true,
    existingRecordFingerprintCurrent: value.existingRecordFingerprintCurrent === true,
    pendingGroupFingerprintCurrent: value.pendingGroupFingerprintCurrent === true,
    existingRecord: (value.existingRecord ?? applied?.before ?? {}) as HarvestValues,
    pendingSubmission: (value.pendingSubmission ?? applied?.after ?? {}) as HarvestValues,
    delta: (value.delta ?? value.cycleTotalDelta ?? applied?.delta ?? {}) as CycleTotals,
    cycleTotalsBefore: (value.cycleTotalsBefore ?? applied?.cycleTotalsBefore ?? {}) as CycleTotals,
    projectedCycleTotals: (value.projectedCycleTotals ?? applied?.projectedCycleTotals ?? {}) as CycleTotals,
    decision: (value.decision ?? {
      id: 0,
      action: applied?.supervisorAction ?? "",
      reason: applied?.supervisorReason ?? "",
      supervisor: applied?.supervisor ?? "",
      decidedAt: applied?.decisionTimestamp ?? null,
    }) as ReplacementProposal["decision"],
    existingRecordFingerprint: String(value.existingRecordFingerprint ?? ""),
    pendingGroupFingerprint: String(value.pendingGroupFingerprint ?? ""),
    pendingCycleSourceFingerprint: String(value.pendingCycleSourceFingerprint ?? ""),
    confirmationPhrase: String(value.confirmationPhrase ?? ""),
    latestRun,
  }
}

function normalizeDryRun(value: Record<string, unknown>): ReplacementDryRun {
  return {
    status: String(value.status ?? ""),
    transactionRolledBack: value.transactionRolledBack === true,
    hostLockVerified: value.hostLockVerified === true,
    postgresAdvisoryLockVerified: value.postgresAdvisoryLockVerified === true,
    dryRunAt: (value.dryRunAt ?? value.dryRunTimestamp ?? null) as string | null,
    auditRowsGenerated: Number(value.auditRowsGenerated ?? value.auditRowsToWrite ?? 0),
    dryRunToken: String(value.dryRunToken ?? ""),
    tokenExpiresAt: (value.tokenExpiresAt ?? value.dryRunTokenExpiresAt ?? null) as string | null,
    before: (value.before ?? value.beforeValues ?? {}) as HarvestValues,
    after: (value.after ?? value.afterValues ?? {}) as HarvestValues,
    delta: (value.delta ?? value.cycleTotalDelta ?? {}) as CycleTotals,
    projectedCycleTotals: (value.projectedCycleTotals ?? {}) as CycleTotals,
  }
}

function ValuesCard({ title, values }: { title: string; values: HarvestValues }) {
  return (
    <article className="rounded-xl border bg-background p-3">
      <h5 className="text-xs font-black uppercase tracking-wide text-muted-foreground">{title}</h5>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        {values.harvestRecordId ? (
          <div>
            <dt className="font-bold text-muted-foreground">Harvest record ID</dt>
            <dd className="font-black">{values.harvestRecordId}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-bold text-muted-foreground">Tree Number</dt>
          <dd className="font-black">{values.treeNo}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted-foreground">Harvest date</dt>
          <dd>{displayDate(values.harvestDate)}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted-foreground">Bunch count</dt>
          <dd>{numberText(values.totalBunches)}</dd>
        </div>
        <div><dt className="font-bold text-muted-foreground">B1</dt><dd>{numberText(values.b1)}</dd></div>
        <div><dt className="font-bold text-muted-foreground">B2</dt><dd>{numberText(values.b2)}</dd></div>
        <div><dt className="font-bold text-muted-foreground">B3</dt><dd>{numberText(values.b3)}</dd></div>
        <div>
          <dt className="font-bold text-muted-foreground">Total nuts</dt>
          <dd>{numberText(values.totalNuts)}</dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="font-bold text-muted-foreground">ODK instance ID</dt>
          <dd className="break-all font-mono">{values.odkInstanceId || "—"}</dd>
        </div>
      </dl>
    </article>
  )
}

function TotalsCard({ title, totals }: { title: string; totals: CycleTotals }) {
  return (
    <article className="rounded-xl border bg-background p-3 text-xs">
      <h5 className="font-black uppercase tracking-wide text-muted-foreground">{title}</h5>
      <p className="mt-2 font-black">
        {numberText(totals.trees)} trees · {numberText(totals.bunches)} bunches · {numberText(totals.nuts)} nuts
      </p>
    </article>
  )
}

export function HarvestControlledReplacement({
  scanId,
  harvestDate,
  harvestCycle,
  treeNo,
  existingHarvestRecordId,
  pendingOdkInstanceId,
  disabled = false,
  onReplacementApplied,
}: Props) {
  const [proposal, setProposal] = useState<ReplacementProposal | null>(null)
  const [dryRun, setDryRun] = useState<ReplacementDryRun | null>(null)
  const [completedRun, setCompletedRun] = useState<ReplacementRun | null>(null)
  const [confirmationInput, setConfirmationInput] = useState("")
  const [clockNow, setClockNow] = useState(() => Date.now())
  const [busy, setBusy] = useState<"proposal" | "dry-run" | "apply" | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const proposalUrl = useMemo(() => {
    const query = new URLSearchParams({
      scan_id: String(scanId),
      harvest_date: harvestDate,
      harvest_cycle: String(harvestCycle),
      tree_no: treeNo,
    })
    return `/api/admin/harvest-sync/controlled-replacements/proposal?${query.toString()}`
  }, [harvestCycle, harvestDate, scanId, treeNo])

  const loadProposal = useCallback(async () => {
    setBusy("proposal")
    setMessage(null)
    try {
      const response = await fetch(proposalUrl, { cache: "no-store" })
      const data = (await response.json()) as ReplacementProposal & {
        proposal?: ReplacementProposal
        detail?: string
        error?: string
      }
      if (!response.ok) {
        throw new Error(errorMessage(data, `Controlled replacement returned HTTP ${response.status}.`))
      }
      const nextProposal = normalizeProposal(
        (data.proposal ?? data) as unknown as Record<string, unknown>,
      )
      setProposal(nextProposal)
      setCompletedRun(nextProposal.latestRun ?? null)
      setDryRun(null)
      setConfirmationInput("")
    } catch (error) {
      setProposal(null)
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Unable to load the controlled replacement proposal.",
      })
    } finally {
      setBusy(null)
    }
  }, [proposalUrl])

  useEffect(() => {
    void loadProposal()
  }, [loadProposal])

  useEffect(() => {
    if (!dryRun?.tokenExpiresAt) return
    const expiresAt = Date.parse(dryRun.tokenExpiresAt)
    if (!Number.isFinite(expiresAt)) return
    const timeout = window.setTimeout(
      () => setClockNow(Date.now()),
      Math.max(0, expiresAt - Date.now()) + 25,
    )
    return () => window.clearTimeout(timeout)
  }, [dryRun?.tokenExpiresAt])

  function authoritativePayload(current: ReplacementProposal) {
    return {
      scan_id: scanId,
      harvest_date: harvestDate,
      harvest_cycle: String(harvestCycle),
      tree_no: treeNo,
      decision_id: current.decision.id,
      existing_harvest_record_id: current.existingRecord.harvestRecordId ?? existingHarvestRecordId,
      existing_record_fingerprint: current.existingRecordFingerprint,
      pending_odk_instance_id: current.pendingSubmission.odkInstanceId ?? pendingOdkInstanceId,
      pending_group_fingerprint: current.pendingGroupFingerprint,
      pending_cycle_source_fingerprint: current.pendingCycleSourceFingerprint,
      expected_cycle_totals_before: current.cycleTotalsBefore,
      expected_projected_cycle_totals: current.projectedCycleTotals,
    }
  }

  async function runDryRun() {
    if (
      !proposal ||
      disabled ||
      !proposal.eligible ||
      !proposal.cycleOpen ||
      !proposal.existingRecordFingerprintCurrent ||
      !proposal.pendingGroupFingerprintCurrent ||
      !/^[a-f0-9]{64}$/i.test(proposal.pendingCycleSourceFingerprint) ||
      proposal.status !== "CORRECTION_REQUIRED"
    ) return
    setBusy("dry-run")
    setMessage(null)
    setDryRun(null)
    setConfirmationInput("")
    try {
      const response = await fetch("/api/admin/harvest-sync/controlled-replacements/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authoritativePayload(proposal)),
      })
      const data = (await response.json()) as ReplacementDryRun & {
        result?: ReplacementDryRun
        detail?: string
        error?: string
      }
      if (!response.ok) {
        throw new Error(errorMessage(data, `Controlled replacement dry run returned HTTP ${response.status}.`))
      }
      const result = normalizeDryRun(
        (data.result ?? data) as unknown as Record<string, unknown>,
      )
      if (result.status !== "PASS" || result.transactionRolledBack !== true || !result.dryRunToken) {
        throw new Error("The controlled replacement dry run did not return a verified rollback receipt.")
      }
      setDryRun(result)
      setClockNow(Date.now())
      setMessage({ ok: true, text: "Controlled replacement dry run passed and was rolled back." })
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "The controlled replacement dry run failed.",
      })
    } finally {
      setBusy(null)
    }
  }

  async function applyReplacement() {
    if (!proposal || !dryRun || disabled) return
    if (confirmationInput.trim() !== proposal.confirmationPhrase) return
    setBusy("apply")
    setMessage(null)
    try {
      const response = await fetch("/api/admin/harvest-sync/controlled-replacements/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...authoritativePayload(proposal),
          dry_run_token: dryRun.dryRunToken,
          confirmation_phrase: confirmationInput.trim(),
        }),
      })
      const data = (await response.json()) as ReplacementRun & {
        result?: ReplacementRun
        detail?: string
        error?: string
      }
      if (!response.ok) {
        throw new Error(errorMessage(data, `Controlled replacement returned HTTP ${response.status}.`))
      }
      const result = normalizeRun(
        (data.result ?? data) as unknown as Record<string, unknown>,
      )
      setCompletedRun(result)
      setDryRun(null)
      setConfirmationInput("")
      setMessage({
        ok: true,
        text:
          result.status === "CORRECTION_APPLIED" || result.status === "SUCCESS"
            ? "Controlled correction applied."
            : "Controlled correction request completed.",
      })
      try {
        await onReplacementApplied()
      } catch {
        setMessage({
          ok: true,
          text: "Controlled correction applied, but the surrounding scan view could not refresh. Reload the page to view the committed audit result.",
        })
      }
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Unable to apply the controlled replacement.",
      })
    } finally {
      setBusy(null)
    }
  }

  const tokenExpiresAt = dryRun?.tokenExpiresAt ? Date.parse(dryRun.tokenExpiresAt) : Number.NaN
  const tokenUnexpired = Boolean(dryRun?.dryRunToken) && Number.isFinite(tokenExpiresAt) && tokenExpiresAt > clockNow
  const applyBlockers: string[] = []
  if (!proposal?.eligible) applyBlockers.push("The saved correction proposal is not currently eligible.")
  if (proposal?.status !== "CORRECTION_REQUIRED") applyBlockers.push("This correction is no longer pending.")
  if (proposal?.manualCorrectionEnabled !== true) applyBlockers.push("Controlled corrections are disabled by the Preview runtime.")
  if (proposal?.cycleOpen !== true) applyBlockers.push("The selected Harvest Cycle must remain Open.")
  if (proposal?.existingRecordFingerprintCurrent !== true) applyBlockers.push("The existing Harvest record fingerprint is stale.")
  if (proposal?.pendingGroupFingerprintCurrent !== true) applyBlockers.push("The pending ODK group fingerprint is stale.")
  if (!/^[a-f0-9]{64}$/i.test(proposal?.pendingCycleSourceFingerprint ?? "")) {
    applyBlockers.push("The same-Tree pending Cycle source fingerprint is missing or invalid.")
  }
  if (!dryRun || dryRun.status !== "PASS" || dryRun.transactionRolledBack !== true) {
    applyBlockers.push("Run and pass the authoritative controlled replacement dry run.")
  }
  if (!tokenUnexpired) applyBlockers.push("A valid, unexpired one-time dry-run token is required.")
  if (confirmationInput.trim() !== proposal?.confirmationPhrase) {
    applyBlockers.push("Enter the exact dynamic confirmation phrase.")
  }

  const appliedRun = proposal?.latestRun ?? completedRun
  const isApplied =
    proposal?.status === "CORRECTION_APPLIED" ||
    appliedRun?.status === "CORRECTION_APPLIED" ||
    appliedRun?.status === "SUCCESS"

  return (
    <section className="mt-4 rounded-2xl border-2 border-rose-300 bg-rose-50/60 p-4" aria-label={`Controlled Harvest record replacement for Tree ${treeNo}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-rose-700" aria-hidden="true" />
            <h4 className="text-sm font-black uppercase tracking-wide">Controlled Harvest Record Replacement</h4>
          </div>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            “Amend Supervisor Decision” changes only the saved proposal. This separate workflow is required to correct the imported master record.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${isApplied ? "border-emerald-300 bg-emerald-100 text-emerald-950" : "border-rose-300 bg-rose-100 text-rose-950"}`}>
          {isApplied ? "CORRECTION APPLIED" : "CORRECTION REQUIRED"}
        </span>
      </div>

      {busy === "proposal" ? <p className="mt-4 text-sm font-semibold">Loading controlled replacement review…</p> : null}
      {!proposal && busy !== "proposal" ? (
        <button type="button" onClick={() => void loadProposal()} className="mt-4 inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-black">
          <RefreshCw className="size-4" aria-hidden="true" /> Retry
        </button>
      ) : null}

      {proposal ? (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <ValuesCard title="Existing imported record — before" values={proposal.existingRecord} />
            <ValuesCard title="Reviewed pending submission — after" values={proposal.pendingSubmission} />
          </div>
          <div className="mt-3 rounded-xl border bg-background p-3 text-xs">
            <p><span className="font-black">Supervisor reason:</span> {proposal.decision.reason || "—"}</p>
            <p className="mt-1"><span className="font-black">Supervisor:</span> {proposal.decision.supervisor || "—"} · {formatIstDateTime(proposal.decision.decidedAt)}</p>
            {!isApplied ? (
              <>
                <p className="mt-1"><span className="font-black">Existing record fingerprint:</span> {proposal.existingRecordFingerprintCurrent ? "Current" : "Changed"}</p>
                <p className="mt-1"><span className="font-black">Pending group fingerprint:</span> {proposal.pendingGroupFingerprintCurrent ? "Current" : "Changed"}</p>
                <p className="mt-1"><span className="font-black">Pending Cycle source fingerprint:</span> {/^[a-f0-9]{64}$/i.test(proposal.pendingCycleSourceFingerprint) ? "Bound" : "Missing"}</p>
                <p className="mt-1"><span className="font-black">Cycle status:</span> {proposal.cycleOpen ? "Open" : "Not Open"}</p>
              </>
            ) : null}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <p className="rounded-xl border bg-background p-3 text-xs"><span className="block font-bold text-muted-foreground">Tree count change</span><span className="text-base font-black">{numberText(proposal.delta.trees, true)}</span></p>
            <p className="rounded-xl border bg-background p-3 text-xs"><span className="block font-bold text-muted-foreground">Bunch count change</span><span className="text-base font-black">{numberText(proposal.delta.bunches, true)}</span></p>
            <p className="rounded-xl border bg-background p-3 text-xs"><span className="block font-bold text-muted-foreground">Nut count change</span><span className="text-base font-black">{numberText(proposal.delta.nuts, true)}</span></p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <TotalsCard title="Current Cycle totals" totals={proposal.cycleTotalsBefore} />
            <TotalsCard title="Projected Cycle totals" totals={proposal.projectedCycleTotals} />
          </div>

          {!isApplied ? (
            <>
              <button
                type="button"
                onClick={() => void runDryRun()}
                disabled={
                  disabled ||
                  busy !== null ||
                  !proposal.eligible ||
                  !proposal.cycleOpen ||
                  !proposal.existingRecordFingerprintCurrent ||
                  !proposal.pendingGroupFingerprintCurrent ||
                  !/^[a-f0-9]{64}$/i.test(proposal.pendingCycleSourceFingerprint)
                }
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "dry-run" ? "Running rollback-only dry run…" : "Run Controlled Replacement Dry Run"}
              </button>

              {dryRun ? (
                <section className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-black text-emerald-950">
                    <CheckCircle2 className="size-5" aria-hidden="true" /> PASS — transaction rolled back
                  </div>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <p><span className="font-bold">Host lock:</span> {dryRun.hostLockVerified ? "PASS" : "FAILED"}</p>
                    <p><span className="font-bold">Advisory lock:</span> {dryRun.postgresAdvisoryLockVerified ? "PASS" : "FAILED"}</p>
                    <p><span className="font-bold">Audit rows:</span> {numberText(dryRun.auditRowsGenerated)}</p>
                    <p><span className="font-bold">Dry-run time:</span> {formatIstDateTime(dryRun.dryRunAt)}</p>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <ValuesCard title="Verified before values" values={dryRun.before} />
                    <ValuesCard title="Verified after values" values={dryRun.after} />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <TotalsCard title="Verified Cycle-total delta" totals={dryRun.delta} />
                    <TotalsCard title="Verified projected Cycle totals" totals={dryRun.projectedCycleTotals} />
                  </div>
                  <p className="mt-3 text-xs font-semibold">One-time confirmation token expires {formatIstDateTime(dryRun.tokenExpiresAt)}. The token is never displayed.</p>
                </section>
              ) : null}

              <div className="mt-4 rounded-xl border bg-background p-3">
                <label htmlFor={`controlled-replacement-phrase-${treeNo}`} className="text-xs font-bold uppercase text-muted-foreground">
                  Exact confirmation phrase
                </label>
                <p className="mt-1 break-words font-mono text-sm font-black">{proposal.confirmationPhrase}</p>
                <input
                  id={`controlled-replacement-phrase-${treeNo}`}
                  value={confirmationInput}
                  onChange={(event) => setConfirmationInput(event.target.value)}
                  disabled={disabled || !dryRun}
                  autoComplete="off"
                  className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
                {applyBlockers.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">
                    <p className="font-black">Apply Controlled Replacement remains unavailable:</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {applyBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                    </ul>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void applyReplacement()}
                  disabled={disabled || busy !== null || applyBlockers.length > 0}
                  className="mt-3 rounded-lg bg-rose-700 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === "apply" ? "Applying controlled replacement…" : "Apply Controlled Replacement"}
                </button>
              </div>
            </>
          ) : null}

          {isApplied && appliedRun ? (
            <section className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs">
              <h5 className="text-sm font-black text-emerald-950">CORRECTION APPLIED</h5>
              <p className="mt-2"><span className="font-bold">Correction run ID:</span> {appliedRun.runId}</p>
              <p><span className="font-bold">Harvest record ID:</span> {proposal.existingRecord.harvestRecordId ?? existingHarvestRecordId ?? "—"}</p>
              <p><span className="font-bold">Applied:</span> {formatIstDateTime(appliedRun.appliedAt)} by {appliedRun.appliedBy || "—"}</p>
              {appliedRun.before && appliedRun.after ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <ValuesCard title="Permanent audit — before" values={appliedRun.before} />
                  <ValuesCard title="Permanent audit — after" values={appliedRun.after} />
                </div>
              ) : null}
              {appliedRun.cycleTotalsAfter ? <div className="mt-3"><TotalsCard title="Updated Cycle totals" totals={appliedRun.cycleTotalsAfter} /></div> : null}
              <a
                href={appliedRun.auditCsvUrl ?? `/api/admin/harvest-sync/controlled-replacements/${appliedRun.runId}/audit.csv`}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-400 bg-background px-3 py-2 font-black"
              >
                <Download className="size-4" aria-hidden="true" /> Download Correction Audit CSV
              </a>
              <p className="mt-2 break-all font-mono">SHA-256: {appliedRun.auditCsvSha256 || "Generated with download"}</p>
              <p className="mt-2 font-bold">Refresh the date-scoped batch before the next normal dry run or import.</p>
            </section>
          ) : null}
        </>
      ) : null}

      {message ? (
        <p role="status" aria-live={message.ok ? "polite" : "assertive"} className={`mt-3 flex items-start gap-2 text-xs font-bold ${message.ok ? "text-emerald-800" : "text-rose-800"}`}>
          {message.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          {message.text}
        </p>
      ) : null}
    </section>
  )
}
