import { ExternalLink } from "lucide-react"
import {
  odkFormSubmissionsUrl,
  previewOdkForms,
  type PreviewOdkFormKey,
} from "@/lib/odk-preview"

export function OdkCentralLink({
  form,
  className = "",
}: {
  form: PreviewOdkFormKey
  className?: string
}) {
  const source = previewOdkForms[form]

  return (
    <a
      href={odkFormSubmissionsUrl(source.projectId, source.formId)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted ${className}`}
    >
      Open ODK Central
      <ExternalLink className="size-4" aria-hidden="true" />
    </a>
  )
}
