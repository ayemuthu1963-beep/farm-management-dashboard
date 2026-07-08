import { Search, RotateCcw, SlidersHorizontal } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { CoconutSubheader } from "@/components/coconut/coconut-subheader"
import { treeClassifications } from "@/lib/coconut-harvest-data"

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"

function RangeField({ label, id, type = "number" }: { label: string; id: string; type?: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="flex items-center gap-2">
        <input id={`${id}-from`} type={type} placeholder="From" aria-label={`${label} from`} className={inputClass} />
        <span className="text-xs text-muted-foreground">to</span>
        <input id={`${id}-to`} type={type} placeholder="To" aria-label={`${label} to`} className={inputClass} />
      </div>
    </fieldset>
  )
}

function ClassificationField({ label, id }: { label: string; id: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select id={id} defaultValue="All" className={inputClass}>
        {treeClassifications.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function DetailedQueryPage() {
  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <CoconutSubheader
          breadcrumb="Detailed Query"
          title="Detailed Search and Filter"
          subtitle="Apply multiple filters to get exact results. This page is ready for the detailed query backend rules."
        />

        <Panel title="Filters" icon={SlidersHorizontal}>
          <form>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <RangeField label="Tree Number" id="tree" />
              <RangeField label="Harvest Cycle" id="cycle" />
              <RangeField label="Harvest Date" id="date" type="date" />
              <RangeField label="Nuts" id="nuts" />
              <RangeField label="Sale (Rs.)" id="sale" />
              <RangeField label="No. of Missed Harvests" id="missed" />
              <ClassificationField label="Tree Classification - Plot 1" id="class-plot1" />
              <ClassificationField label="Tree Classification - Plot 2" id="class-plot2" />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <Search className="size-4" aria-hidden="true" />
                Show Results
              </button>
              <button
                type="reset"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset Filters
              </button>
            </div>
          </form>
        </Panel>
      </div>
    </DashboardShell>
  )
}
