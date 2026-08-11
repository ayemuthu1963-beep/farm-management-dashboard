"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import type { Account, AccountType } from "@/lib/worker-management"

interface AccountFormValues {
  type: AccountType
  name: string
  phone: string
  joinDate: string
  rate: string
  groupHead: string
  memberCount: string
}

function toFormValues(account: Account | null): AccountFormValues {
  if (!account) {
    return {
      type: "Farm",
      name: "",
      phone: "",
      joinDate: new Date().toISOString().slice(0, 10),
      rate: "",
      groupHead: "",
      memberCount: "",
    }
  }
  return {
    type: account.type,
    name: account.name,
    phone: account.phone ?? "",
    joinDate: account.joinDate,
    rate: String(account.rate),
    groupHead: account.groupHead ?? "",
    memberCount: account.memberCount ? String(account.memberCount) : "",
  }
}

export interface AccountFormSubmit {
  type: AccountType
  name: string
  phone?: string
  joinDate: string
  rate: number
  groupHead?: string
  memberCount?: number
}

export function AccountForm({
  account,
  onSubmit,
  onCancel,
}: {
  account: Account | null
  onSubmit: (values: AccountFormSubmit) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<AccountFormValues>(() => toFormValues(account))
  const [error, setError] = useState<string | null>(null)
  const isGroup = values.type === "Group"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const rate = Number.parseFloat(values.rate)
    if (!values.name.trim()) {
      setError("Enter a name for this account.")
      return
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      setError(isGroup ? "Enter a valid rate per attending head." : "Enter a valid daily wage.")
      return
    }
    if (isGroup) {
      const memberCount = Number.parseInt(values.memberCount, 10)
      if (!values.groupHead.trim()) {
        setError("Enter the group head's name.")
        return
      }
      if (!Number.isFinite(memberCount) || memberCount <= 0) {
        setError("Enter a valid member count.")
        return
      }
      onSubmit({
        type: "Group",
        name: values.name.trim(),
        joinDate: values.joinDate,
        rate,
        groupHead: values.groupHead.trim(),
        memberCount,
      })
      return
    }
    onSubmit({
      type: values.type,
      name: values.name.trim(),
      phone: values.phone.trim() || undefined,
      joinDate: values.joinDate,
      rate,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Account type</span>
          <select
            value={values.type}
            disabled={Boolean(account)}
            onChange={(event) => setValues((prev) => ({ ...prev, type: event.target.value as AccountType }))}
            className="rounded-lg border border-input bg-background px-3 py-2 disabled:opacity-60"
          >
            <option value="Farm">Farm</option>
            <option value="Outside">Outside</option>
            <option value="Group">Group</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">{isGroup ? "Group name" : "Name"}</span>
          <input
            value={values.name}
            onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded-lg border border-input bg-background px-3 py-2"
            placeholder={isGroup ? "e.g. Harvest Group C" : "e.g. Ravi Kumar"}
          />
        </label>

        {isGroup ? (
          <>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Group head</span>
              <input
                value={values.groupHead}
                onChange={(event) => setValues((prev) => ({ ...prev, groupHead: event.target.value }))}
                className="rounded-lg border border-input bg-background px-3 py-2"
                placeholder="e.g. Selvam"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Member count</span>
              <input
                type="number"
                min="1"
                value={values.memberCount}
                onChange={(event) => setValues((prev) => ({ ...prev, memberCount: event.target.value }))}
                className="rounded-lg border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Rate per attending head (₹)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.rate}
                onChange={(event) => setValues((prev) => ({ ...prev, rate: event.target.value }))}
                className="rounded-lg border border-input bg-background px-3 py-2"
              />
            </label>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Phone</span>
              <input
                value={values.phone}
                onChange={(event) => setValues((prev) => ({ ...prev, phone: event.target.value }))}
                className="rounded-lg border border-input bg-background px-3 py-2"
                placeholder="+91 98420 00000"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Daily wage (₹)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.rate}
                onChange={(event) => setValues((prev) => ({ ...prev, rate: event.target.value }))}
                className="rounded-lg border border-input bg-background px-3 py-2"
              />
            </label>
          </>
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Join date</span>
          <input
            type="date"
            value={values.joinDate}
            onChange={(event) => setValues((prev) => ({ ...prev, joinDate: event.target.value }))}
            className="rounded-lg border border-input bg-background px-3 py-2"
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit">{account ? "Save changes" : "Add account"}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
