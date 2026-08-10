import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react"
import { cn } from "@/lib/utils"
import { formatINR, formatSignedINR, money } from "@/lib/worker-management-format"

export function buttonClassName(
  variant: "primary" | "secondary" | "ghost" | "danger" = "primary",
  className?: string,
) {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55",
    variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
    variant === "secondary" && "border border-border bg-card hover:bg-muted",
    variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
    variant === "danger" && "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    className,
  )
}
export function WorkerButton({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger"
}) {
  return <button type={type} className={buttonClassName(variant, className)} {...props} />
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode
  tone?: "muted" | "green" | "red" | "amber" | "blue"
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone === "green" && "bg-primary/10 text-primary",
        tone === "red" && "bg-red-100 text-red-700",
        tone === "amber" && "bg-amber-100 text-amber-800",
        tone === "blue" && "bg-blue-100 text-blue-700",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  )
}

export function Currency({
  value,
  signed = false,
  className,
}: {
  value: string | number | null | undefined
  signed?: boolean
  className?: string
}) {
  const numeric = money(value)
  return (
    <span className={cn("tabular-nums", signed && numeric < 0 && "text-red-600", className)}>
      {signed ? formatSignedINR(numeric) : formatINR(numeric)}
    </span>
  )
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? <p className="text-sm font-semibold text-primary">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}

export function Notice({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "error" | "success" | "warning"
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border p-4 text-sm",
        tone === "neutral" && "border-border bg-card text-muted-foreground",
        tone === "error" && "border-red-200 bg-red-50 font-semibold text-red-700",
        tone === "success" && "border-primary/25 bg-primary/5 font-semibold text-primary",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export function WorkerInput({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={cn("block text-sm font-semibold", className)}>
      {label}
      <input
        className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        {...props}
      />
      {hint ? <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

export function WorkerSelect({
  label,
  hint,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  return (
    <label className={cn("block text-sm font-semibold", className)}>
      {label}
      <select
        className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        {...props}
      >
        {children}
      </select>
      {hint ? <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

export function LoadingState({ label = "Loading Worker Management data…" }: { label?: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center rounded-xl border border-border bg-card p-8 text-sm font-semibold text-muted-foreground">
      {label}
    </div>
  )
}
