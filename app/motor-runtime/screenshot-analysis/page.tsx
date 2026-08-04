"use client"

import { useMemo, useRef, useState } from "react"
import { CalendarRange, Gauge, Info } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import {
  RUN_RECORDS,
  SAMPLE_PERIOD,
  SCREENSHOTS_PROCESSED,
  combinedMinutes,
  countCompleteRuns,
  countUnmatched,
  groupByDate,
  summariseAllMotors,
} from "@/lib/motor-screenshot-analysis-mock-data"
import type { MotorId, RunRecord } from "@/lib/motor-screenshot-analysis-types"
import { formatDateRange } from "@/lib/motor-screenshot-analysis-format"
import { AnalysisPageHeader } from "@/components/motor-screenshot-analysis/analysis-page-header"
import { ScreenshotUploadPanel } from "@/components/motor-screenshot-analysis/screenshot-upload-panel"
import { ProcessingLogicNote } from "@/components/motor-screenshot-analysis/processing-logic-note"
import { AnalysisSummaryCards } from "@/components/motor-screenshot-analysis/analysis-summary-cards"
import { MotorSummaryCard } from "@/components/motor-screenshot-analysis/motor-summary-card"
import {
  AnalysisFilters,
  DEFAULT_FILTERS,
  applyFilters,
  type Filters,
} from "@/components/motor-screenshot-analysis/analysis-filters"
import { DateRuntimeGroup } from "@/components/motor-screenshot-analysis/date-runtime-group"
import { RuntimeRecordsTable } from "@/components/motor-screenshot-analysis/runtime-records-table"
import { ScreenshotViewer } from "@/components/motor-screenshot-analysis/screenshot-viewer"

export default function ScreenshotAnalysisPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [activeRecord, setActiveRecord] = useState<RunRecord | null>(null)
  const recordsRef = useRef<HTMLDivElement>(null)

  // Period overview (summary tiles + motor cards) reflects the full sample set.
  const motorSummaries = useMemo(() => summariseAllMotors(RUN_RECORDS), [])
  const periodTotals = useMemo(
    () => ({
      combined: combinedMinutes(RUN_RECORDS),
      complete: countCompleteRuns(RUN_RECORDS),
      unmatched: countUnmatched(RUN_RECORDS),
    }),
    [],
  )

  // Filters drive the date-wise summary and the detailed table.
  const filtered = useMemo(() => applyFilters(RUN_RECORDS, filters), [filters])
  const dateGroups = useMemo(() => groupByDate(filtered), [filtered])

  function handleViewMotorRecords(motorId: MotorId) {
    setFilters((f) => ({ ...f, motor: motorId }))
    recordsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <AnalysisPageHeader />

        {/* Upload */}
        <div className="flex flex-col gap-4">
          <ScreenshotUploadPanel />
          <ProcessingLogicNote />
        </div>

        {/* Summary tiles */}
        <Panel
          title="Runtime summary"
          icon={CalendarRange}
          headerRight={
            <span className="text-xs font-medium normal-case tracking-normal text-muted-foreground">
              Selected period: {formatDateRange(SAMPLE_PERIOD.start, SAMPLE_PERIOD.end)}
            </span>
          }
        >
          <AnalysisSummaryCards
            periodLabel={formatDateRange(SAMPLE_PERIOD.start, SAMPLE_PERIOD.end)}
            motorSummaries={motorSummaries}
            combinedMinutes={periodTotals.combined}
            screenshotsProcessed={SCREENSHOTS_PROCESSED}
            completeRuns={periodTotals.complete}
            unmatched={periodTotals.unmatched}
          />
        </Panel>

        {/* Motor cards */}
        <Panel title="Motor-wise summary" icon={Gauge}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {motorSummaries.map((s) => (
              <MotorSummaryCard
                key={s.motor.id}
                summary={s}
                onViewRecords={handleViewMotorRecords}
              />
            ))}
          </div>
        </Panel>

        {/* Filters */}
        <AnalysisFilters filters={filters} onChange={setFilters} resultCount={filtered.length} />

        {/* Date-wise summary */}
        <Panel
          title="Date-wise runtime"
          icon={CalendarRange}
          headerRight={
            <span className="text-xs font-medium normal-case tracking-normal text-muted-foreground">
              Grouped by day. Expand a day to see its records.
            </span>
          }
        >
          <div className="flex flex-col gap-3">
            {dateGroups.map((g, i) => (
              <DateRuntimeGroup
                key={g.date}
                summary={g}
                defaultOpen={i === 0}
                onViewScreenshot={setActiveRecord}
              />
            ))}
            {dateGroups.length === 0 && (
              <p className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                No runs in the selected period.
              </p>
            )}
          </div>
        </Panel>

        {/* Detailed table */}
        <div ref={recordsRef} className="scroll-mt-4">
          <RuntimeRecordsTable records={filtered} onViewScreenshot={setActiveRecord} />
        </div>

        {/* Static implementation notice */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Static frontend preview for MFMS. All figures use fixed sample data held in browser
            memory. No backend, database, OCR, AI vision or external storage is connected — these
            will be wired up during backend integration.
          </p>
        </div>
      </div>

      <ScreenshotViewer record={activeRecord} onClose={() => setActiveRecord(null)} />
    </DashboardShell>
  )
}
