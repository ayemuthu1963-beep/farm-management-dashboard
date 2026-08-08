import { Database, ExternalLink } from "lucide-react"
import {
  odkFormSubmissionsUrl,
  FIELD_COLLECTOR_PROJECT_NAME,
  previewOdkForms,
  type PreviewOdkFormKey,
} from "@/lib/odk-preview"

export function PreviewOdkSourceCard({ form }: { form: PreviewOdkFormKey }) {
  const source = previewOdkForms[form]

  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-extrabold text-foreground">ODK source: {source.label}</p>
            <p className="mt-1 text-muted-foreground">
              {FIELD_COLLECTOR_PROJECT_NAME} · Project {source.projectId} · Form {source.formId}
              {source.publishedVersion ? ` · Published version ${source.publishedVersion}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Field entry is through the assigned ODK Collect App User. This Central link is for authorised administration and submission review.
            </p>
          </div>
        </div>
        <a
          href={odkFormSubmissionsUrl(source.projectId, source.formId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-semibold text-foreground shadow-sm hover:bg-muted"
        >
          Review in ODK Central
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}
