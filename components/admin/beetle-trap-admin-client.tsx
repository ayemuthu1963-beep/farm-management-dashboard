"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Bug, CalendarDays, CheckCircle2, Database, Info, MapPin, ShieldAlert, Target } from "lucide-react"
import { Panel } from "@/components/farm/panel"
import { StatCard } from "@/components/farm/stat-card"

interface AdminSummary {
  latestReset: {
    pheromoneLureInstalledDate: string | null
    cumulativeCountStartDate: string | null
    remarks: string | null
    source: string | null
    createdAt: string | null
    updatedAt: string | null
  }
  trapSummary: {
    totalTraps: number
    redPalmWeevilTraps: number
    rhinocerosBeetleTraps: number
  }
  locations: Array<{
    trapNo: string
    trapType: string
    latitude: number
    longitude: number
  }>
  writesEnabled: boolean
}

interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  message: string
  writesEnabled: boolean
}

function formatDate(value: string | null): string {
  if (!value) return "Not available"
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(parsed)
}

function ResultBox({ result }: { result: ValidationResult | null }) {
  if (!result) return null

  return (
    <div
      className={`rounded-xl border p-3 text-sm ${
        result.ok ? "border-primary/25 bg-primary/5 text-primary" : "border-destructive/30 bg-destructive/10 text-destructive"
      }`}
    >
      <div className="flex items-start gap-2">
        {result.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" />}
        <div className="space-y-2">
          <p className="font-semibold">{result.message}</p>
          {result.errors.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {result.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          {result.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-800">
              <p className="font-semibold">Warning</p>
              <ul className="list-disc space-y-1 pl-5">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

async function validateForm(endpoint: string, payload: Record<string, string>): Promise<ValidationResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const data = (await response.json().catch(() => ({}))) as Partial<ValidationResult>
  return {
    ok: response.ok && data.ok === true,
    errors: Array.isArray(data.errors) ? data.errors.map(String) : response.ok ? [] : [`Request failed with status ${response.status}.`],
    warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
    message: data.message ?? (response.ok ? "Admin action completed." : "Admin action was not saved."),
    writesEnabled: data.writesEnabled === true,
  }
}

function requestFailure(error: unknown): ValidationResult {
  return {
    ok: false,
    errors: [error instanceof Error ? error.message : "Unknown network error."],
    warnings: [],
    message: "Admin action was not saved.",
    writesEnabled: false,
  }
}

export function BeetleTrapAdminClient({ summary }: { summary: AdminSummary }) {
  const router = useRouter()
  const [adminAction, setAdminAction] = useState("new-trap")
  const [pheromoneResult, setPheromoneResult] = useState<ValidationResult | null>(null)
  const [trapResult, setTrapResult] = useState<ValidationResult | null>(null)
  const [isPheromoneChecking, setIsPheromoneChecking] = useState(false)
  const [isTrapChecking, setIsTrapChecking] = useState(false)

  async function onPheromoneSubmit(form: HTMLFormElement) {
    const formData = new FormData(form)
    setIsPheromoneChecking(true)
    setPheromoneResult(null)
    try {
      const result = await validateForm("/api/admin/beetle-trap/pheromone-reset", {
        pheromone_installed_on: String(formData.get("pheromone_installed_on") ?? ""),
        remarks: String(formData.get("remarks") ?? ""),
      })
      setPheromoneResult(result)
      if (result.ok) {
        form.reset()
        router.refresh()
      }
    } catch (error) {
      setPheromoneResult(requestFailure(error))
    } finally {
      setIsPheromoneChecking(false)
    }
  }

  async function onTrapSubmit(form: HTMLFormElement) {
    const formData = new FormData(form)
    setIsTrapChecking(true)
    setTrapResult(null)
    try {
      const result = await validateForm("/api/admin/beetle-trap/trap-location", {
        admin_action: String(formData.get("admin_action") ?? ""),
        x: String(formData.get("x") ?? ""),
        y: String(formData.get("y") ?? ""),
        trap_no: String(formData.get("trap_no") ?? ""),
        trap_type: String(formData.get("trap_type") ?? ""),
      })
      setTrapResult(result)
      if (result.ok) {
        form.reset()
        setAdminAction("new-trap")
        router.refresh()
      }
    } catch (error) {
      setTrapResult(requestFailure(error))
    } finally {
      setIsTrapChecking(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">Admin save enabled for pheromone reset, trap type, trap location, and new trap</p>
            <p>Pheromone reset, Change Trap Type Only, Amend Trap Location, and New Trap save directly to the MFMS database. ODK Central is not modified.</p>
          </div>
        </div>
      </div>

      <Panel title="Beetle Trap Admin / Pheromone Reset" icon={CalendarDays}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-primary">Current Latest Reset Setting</h3>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="font-semibold text-muted-foreground">Pheromone Installed On</dt>
                <dd className="text-lg font-extrabold text-foreground">{formatDate(summary.latestReset.pheromoneLureInstalledDate)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted-foreground">Cumulative Count Start Date</dt>
                <dd className="text-lg font-extrabold text-foreground">{formatDate(summary.latestReset.cumulativeCountStartDate)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted-foreground">Remarks</dt>
                <dd className="text-foreground">{summary.latestReset.remarks ?? "Not available in read-only summary"}</dd>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <dt className="font-semibold text-muted-foreground">Source</dt>
                  <dd className="text-foreground">{summary.latestReset.source ?? "Not available"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground">Created</dt>
                  <dd className="text-foreground">{formatDate(summary.latestReset.createdAt)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground">Updated</dt>
                  <dd className="text-foreground">{formatDate(summary.latestReset.updatedAt)}</dd>
                </div>
              </div>
            </dl>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void onPheromoneSubmit(event.currentTarget)
            }}
            className="space-y-4 rounded-xl border border-border bg-card p-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-foreground">
                Pheromone Installed On <span className="text-destructive">*</span>
                <input name="pheromone_installed_on" type="date" className="mt-1 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm" />
              </label>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                This single date will be saved as both pheromone_lure_installed_date and cumulative_count_start_date.
              </div>
            </div>
            <label className="block text-sm font-semibold text-foreground">
              Remarks
              <textarea name="remarks" rows={3} className="mt-1 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm" placeholder="Optional admin audit note" />
            </label>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90" disabled={isPheromoneChecking}>
              {isPheromoneChecking ? "Saving..." : "Save Pheromone Reset"}
            </button>
            <ResultBox result={pheromoneResult} />
          </form>
        </div>
      </Panel>

      <Panel title="New Trap / Amend Old Trap" icon={MapPin}>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={Target} label="Total Traps" value={String(summary.trapSummary.totalTraps)} sublabel="active database records" accent="bg-primary/10 text-primary" />
          <StatCard icon={Bug} label="Red Palm Weevil Traps" value={String(summary.trapSummary.redPalmWeevilTraps)} sublabel="red markers" accent="bg-destructive/10 text-destructive" />
          <StatCard icon={Bug} label="Rhinoceros Beetle Traps" value={String(summary.trapSummary.rhinocerosBeetleTraps)} sublabel="black markers" accent="bg-foreground/10 text-foreground" />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void onTrapSubmit(event.currentTarget)
          }}
          className="space-y-4 rounded-xl border border-border bg-card p-4"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <label className="text-sm font-semibold text-foreground md:col-span-2">
              Admin Action <span className="text-destructive">*</span>
              <select
                name="admin_action"
                className="mt-1 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                value={adminAction}
                onChange={(event) => {
                  setAdminAction(event.target.value)
                  setTrapResult(null)
                }}
              >
                <option value="new-trap">New Trap</option>
                <option value="amend-location">Amend Trap Location</option>
                <option value="change-type">Change Trap Type Only</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-foreground">
              Trap No <span className="text-destructive">*</span>
              <input name="trap_no" list="current-trap-numbers" className="mt-1 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm" placeholder="Select existing or enter new" />
              <datalist id="current-trap-numbers">
                {summary.locations.map((location) => (
                  <option key={location.trapNo} value={location.trapNo}>{location.trapType}</option>
                ))}
              </datalist>
            </label>
            <label className="text-sm font-semibold text-foreground md:col-span-2">
              Trap Type
              <select
                name="trap_type"
                className="mt-1 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                defaultValue=""
                disabled={adminAction === "amend-location"}
              >
                <option value="">Select trap type</option>
                <option value="Red Palm Weevil">Red Palm Weevil</option>
                <option value="Rhinoceros Beetle">Rhinoceros Beetle</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-foreground">
              X Longitude
              <input name="x" className="mt-1 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50" placeholder="Example: 77.07" disabled={adminAction === "change-type"} />
            </label>
            <label className="text-sm font-semibold text-foreground">
              Y Latitude
              <input name="y" className="mt-1 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50" placeholder="Example: 10.48" disabled={adminAction === "change-type"} />
            </label>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p>
                New Trap requires Trap No, Trap Type, X Longitude and Y Latitude. Amend Trap Location requires Trap No, X and Y.
                Change Trap Type Only requires Trap No and Trap Type. X must be longitude around 77.x and Y latitude around 10.x.
              </p>
            </div>
            <p className="mt-2 font-semibold text-primary">Loaded {summary.locations.length} active trap locations from Preview.</p>
          </div>
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90" disabled={isTrapChecking}>
            {isTrapChecking ? "Saving..." : "Validate / Save Trap Admin Action"}
          </button>
          <ResultBox result={trapResult} />
        </form>

        <details className="mt-4 rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-extrabold text-foreground">
            Current Trap Locations ({summary.locations.length})
          </summary>
          <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead className="sticky top-0 bg-primary/10 text-left text-xs font-extrabold uppercase tracking-wide text-primary">
                <tr>
                  <th className="px-3 py-2">Trap No</th>
                  <th className="px-3 py-2">Trap Type</th>
                  <th className="px-3 py-2">Latitude</th>
                  <th className="px-3 py-2">Longitude</th>
                </tr>
              </thead>
              <tbody>
                {summary.locations.map((location) => (
                  <tr key={location.trapNo} className="border-t border-border">
                    <td className="px-3 py-2 font-bold">{location.trapNo}</td>
                    <td className="px-3 py-2">{location.trapType}</td>
                    <td className="px-3 py-2">{location.latitude}</td>
                    <td className="px-3 py-2">{location.longitude}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Panel>

      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p>Pheromone reset, Change Trap Type Only, Amend Trap Location, and New Trap save are enabled. No ODK Central change is made.</p>
        </div>
      </div>
    </div>
  )
}
