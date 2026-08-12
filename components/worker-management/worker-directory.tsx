"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Pencil, Plus, RotateCcw, UserX } from "lucide-react"
import {
  addWageRate,
  changeAccountState,
  createAccount,
  fetchAccounts,
  updateAccount,
} from "@/lib/worker-management-api"
import {
  accountStateLabel,
  accountTypeLabel,
  formatINR,
  toDateInput,
} from "@/lib/worker-management-format"
import type { AccountType, FarmScheme, WorkerAccount } from "@/lib/worker-management-types"
import {
  Badge,
  EmptyState,
  LoadingState,
  Notice,
  SectionTitle,
  WorkerButton,
  WorkerInput,
  WorkerSelect,
} from "./worker-ui"

type WorkerForm = {
  accountCode: string
  accountType: AccountType
  displayName: string
  dailyRate: string
  farmScheme: FarmScheme
  effectiveFrom: string
  groupLeaderName: string
  defaultGroupSize: string
}

function blankForm(accountType: AccountType = "FARM"): WorkerForm {
  return {
    accountCode: "",
    accountType,
    displayName: "",
    dailyRate: "",
    farmScheme: "THREE_OPTION",
    effectiveFrom: toDateInput(),
    groupLeaderName: "",
    defaultGroupSize: "",
  }
}

function formFromAccount(account: WorkerAccount): WorkerForm {
  return {
    accountCode: account.account_code,
    accountType: account.account_type,
    displayName: account.display_name,
    dailyRate: account.daily_rate ?? "",
    farmScheme: account.farm_scheme ?? "THREE_OPTION",
    effectiveFrom: toDateInput(),
    groupLeaderName: account.group_leader_name ?? "",
    defaultGroupSize: account.default_group_size === null ? "" : String(account.default_group_size),
  }
}

export function WorkerDirectory() {
  const [accounts, setAccounts] = useState<WorkerAccount[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<WorkerAccount | null>(null)
  const [form, setForm] = useState<WorkerForm>(blankForm)
  const [stateChangeAccount, setStateChangeAccount] = useState<WorkerAccount | null>(null)
  const [stateReason, setStateReason] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [activeResult, inactiveResult] = await Promise.all([
        fetchAccounts({ isActive: true, pageSize: 200 }),
        fetchAccounts({ isActive: false, pageSize: 200 }),
      ])
      setAccounts([...activeResult.items, ...inactiveResult.items])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load workers.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return accounts.filter(
      (account) =>
        account.is_active === !showInactive &&
        (!query ||
          `${account.account_code} ${account.display_name} ${account.group_leader_name ?? ""} ${account.account_type}`
            .toLowerCase()
            .includes(query)),
    )
  }, [accounts, search, showInactive])

  const activeCount = useMemo(() => accounts.filter((account) => account.is_active).length, [accounts])
  const inactiveCount = accounts.length - activeCount

  const openNew = (accountType: AccountType) => {
    setShowInactive(false)
    setSearch("")
    setEditing(null)
    setForm(blankForm(accountType))
    setFormOpen(true)
    setError("")
    setNotice("")
  }

  const openEdit = (account: WorkerAccount) => {
    setEditing(account)
    setForm(formFromAccount(account))
    setFormOpen(true)
    setError("")
    setNotice("")
  }

  const save = async () => {
    if (!form.accountCode.trim() || !form.displayName.trim() || Number(form.dailyRate) <= 0) {
      setError("Account code, name, and a positive Daily Wage are required.")
      return
    }
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const farmScheme = form.accountType === "FARM" ? form.farmScheme : null
      const groupLeader = form.accountType === "GROUP" ? form.groupLeaderName.trim() || null : null
      const groupSize =
        form.accountType === "GROUP" && form.defaultGroupSize !== ""
          ? Math.max(0, Number(form.defaultGroupSize))
          : null
      if (editing) {
        await updateAccount(editing.account_id, {
          display_name: form.displayName.trim(),
          group_leader_name: groupLeader,
          default_group_size: groupSize,
          expected_row_version: editing.row_version,
        })
        if (
          Number(form.dailyRate) !== Number(editing.daily_rate) ||
          farmScheme !== editing.farm_scheme
        ) {
          await addWageRate(editing.account_id, {
            daily_rate: Number(form.dailyRate).toFixed(2),
            farm_scheme: farmScheme,
            effective_from: form.effectiveFrom,
          })
        }
        setNotice(`${form.displayName.trim()} updated.`)
      } else {
        await createAccount({
          account_code: form.accountCode.trim(),
          account_type: form.accountType,
          display_name: form.displayName.trim(),
          group_leader_name: groupLeader,
          default_group_size: groupSize,
          daily_rate: Number(form.dailyRate).toFixed(2),
          farm_scheme: farmScheme,
          effective_from: form.effectiveFrom,
        })
        setNotice(`${form.displayName.trim()} added.`)
      }
      setFormOpen(false)
      setEditing(null)
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this worker account.")
    } finally {
      setSaving(false)
    }
  }

  const applyStateChange = async () => {
    if (!stateChangeAccount || !stateReason.trim()) {
      setError("A reason is required to change worker status.")
      return
    }
    setSaving(true)
    setError("")
    try {
      await changeAccountState(
        stateChangeAccount.account_id,
        !stateChangeAccount.is_active,
        stateChangeAccount.row_version,
        stateReason.trim(),
      )
      setNotice(
        `${stateChangeAccount.display_name} ${stateChangeAccount.is_active ? "made inactive" : "reactivated"}.`,
      )
      setStateChangeAccount(null)
      setStateReason("")
      await load()
    } catch (stateError) {
      setError(stateError instanceof Error ? stateError.message : "Unable to change worker status.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionTitle
        eyebrow="Worker Management"
        title="Worker directory"
        description="Add, edit, inactivate, and reactivate Farm Workers, Outside Workers, and Group accounts. Historical records remain intact."
      />

      <div className="flex flex-wrap gap-2">
        <WorkerButton onClick={() => openNew("FARM")}><Plus className="size-4" aria-hidden="true" />Add Farm Worker</WorkerButton>
        <WorkerButton variant="secondary" onClick={() => openNew("OUTSIDE")}><Plus className="size-4" aria-hidden="true" />Add Outside Worker</WorkerButton>
        <WorkerButton variant="secondary" onClick={() => openNew("GROUP")}><Plus className="size-4" aria-hidden="true" />Add Group</WorkerButton>
        <WorkerButton
          variant={showInactive ? "primary" : "ghost"}
          className="sm:ml-auto"
          aria-pressed={showInactive}
          onClick={() => {
            setShowInactive((current) => !current)
            setSearch("")
            setFormOpen(false)
            setEditing(null)
            setStateChangeAccount(null)
          }}
        >
          {showInactive ? <RotateCcw className="size-4" aria-hidden="true" /> : <UserX className="size-4" aria-hidden="true" />}
          {showInactive ? `Active Workers (${activeCount})` : `Inactive Workers (${inactiveCount})`}
        </WorkerButton>
      </div>

      {error ? <div className="mt-4"><Notice tone="error">{error}</Notice></div> : null}
      {notice ? <div className="mt-4"><Notice tone="success">{notice}</Notice></div> : null}

      {formOpen ? (
        <div className="mt-5 rounded-xl border border-primary/30 bg-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">{editing ? "Edit account" : "New account"}</p>
              <h2 className="text-lg font-bold">{accountTypeLabel(form.accountType)}</h2>
            </div>
            <Badge tone="blue">Online form</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <WorkerInput
              label="Account code"
              value={form.accountCode}
              disabled={Boolean(editing)}
              onChange={(event) => setForm((current) => ({ ...current, accountCode: event.target.value }))}
              placeholder={form.accountType === "GROUP" ? "GR-001" : form.accountType === "OUTSIDE" ? "OW-001" : "FW-001"}
            />
            <WorkerInput
              label={form.accountType === "GROUP" ? "Group name" : "Name"}
              value={form.displayName}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
            />
            <WorkerInput
              label="Daily Wage"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={form.dailyRate}
              onChange={(event) => setForm((current) => ({ ...current, dailyRate: event.target.value }))}
              hint={form.accountType === "GROUP" ? "Amount per worker per day" : "Amount per full day"}
            />
            {form.accountType === "FARM" ? (
              <WorkerSelect
                label="Payment variants"
                value={form.farmScheme}
                onChange={(event) => setForm((current) => ({ ...current, farmScheme: event.target.value as FarmScheme }))}
              >
                <option value="THREE_OPTION">3 — Full, Half, 1/3, Absent</option>
                <option value="TWO_OPTION">2 — Full, Half, Absent</option>
              </WorkerSelect>
            ) : null}
            {form.accountType === "GROUP" ? (
              <>
                <WorkerInput
                  label="Default group size"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form.defaultGroupSize}
                  onChange={(event) => setForm((current) => ({ ...current, defaultGroupSize: event.target.value }))}
                  hint="May be changed on each workday"
                />
                <WorkerInput
                  label="Group leader (optional)"
                  value={form.groupLeaderName}
                  onChange={(event) => setForm((current) => ({ ...current, groupLeaderName: event.target.value }))}
                  placeholder="Blank = Group account"
                />
              </>
            ) : null}
            <WorkerInput
              label={editing ? "New wage effective from" : "Effective from"}
              type="date"
              value={form.effectiveFrom}
              onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <WorkerButton onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Record"}</WorkerButton>
            <WorkerButton variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</WorkerButton>
          </div>
        </div>
      ) : null}

      {stateChangeAccount ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-bold">
            {stateChangeAccount.is_active ? "Make inactive" : "Reactivate"}: {stateChangeAccount.display_name}
          </h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <WorkerInput
              className="flex-1"
              label="Reason"
              value={stateReason}
              onChange={(event) => setStateReason(event.target.value)}
              placeholder="Required for the audit history"
            />
            <div className="flex gap-2">
              <WorkerButton variant={stateChangeAccount.is_active ? "danger" : "primary"} onClick={applyStateChange} disabled={saving}>
                Confirm
              </WorkerButton>
              <WorkerButton variant="ghost" onClick={() => setStateChangeAccount(null)} disabled={saving}>Cancel</WorkerButton>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-xl border border-border bg-card p-3">
        <label className="block text-sm font-semibold">
          Search {showInactive ? "inactive" : "active"} workers and groups
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, ID, group leader, or type"
            className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal outline-none focus:border-primary"
          />
        </label>
      </div>

      <div className="mt-5">
        {loading ? <LoadingState label="Loading worker directory…" /> : null}
        {!loading && !filteredAccounts.length ? (
          <EmptyState>
            {search.trim()
              ? `No ${showInactive ? "inactive" : "active"} worker accounts match this search.`
              : `No ${showInactive ? "inactive" : "active"} worker accounts.`}
          </EmptyState>
        ) : null}
        {!loading && filteredAccounts.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredAccounts.map((account) => (
              <article key={account.account_id} className={`rounded-xl border border-border bg-card p-4 ${account.is_active ? "" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold">{account.display_name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{account.account_code} · {accountTypeLabel(account.account_type)}</p>
                  </div>
                  <Badge tone={account.is_active ? "green" : "muted"}>{account.is_active ? "Active" : "Inactive"}</Badge>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Daily Wage</dt><dd className="font-bold">{formatINR(account.daily_rate)}</dd></div>
                  {account.account_type === "FARM" ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Variants</dt><dd>{account.farm_scheme === "THREE_OPTION" ? "3" : "2"}</dd></div> : null}
                  {account.account_type === "GROUP" ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Group</dt><dd className="text-right">{account.default_group_size ?? 0} workers · {account.group_leader_name || "Group account"}</dd></div> : null}
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Account</dt><dd>{accountStateLabel(account.account_state)}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <WorkerButton variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => openEdit(account)}>
                    <Pencil className="size-3" aria-hidden="true" />Edit
                  </WorkerButton>
                  <WorkerButton
                    variant="ghost"
                    className="min-h-9 px-3 text-xs"
                    onClick={() => {
                      setStateChangeAccount(account)
                      setStateReason("")
                    }}
                  >
                    {account.is_active ? <UserX className="size-3" aria-hidden="true" /> : <RotateCcw className="size-3" aria-hidden="true" />}
                    {account.is_active ? "Make Inactive" : "Reactivate"}
                  </WorkerButton>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
