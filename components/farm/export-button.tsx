import { Download } from "lucide-react"

interface ExportButtonProps {
  label?: string
}

// Visual-only button. Export functionality is intentionally not wired up
// (static mock UI — Codex will connect real export later).
export function ExportButton({ label = "Export to Excel" }: ExportButtonProps) {
  return (
    <button
      type="button"
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
    >
      <Download className="size-4" aria-hidden="true" />
      {label}
    </button>
  )
}
