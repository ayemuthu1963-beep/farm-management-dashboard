"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarRange, Gauge, Info, LoaderCircle } from "lucide-react"
import { DashboardShell } from "@/components/farm/dashboard-shell"
import { Header } from "@/components/farm/header"
import { Panel } from "@/components/farm/panel"
import { FALLBACK_MOTORS } from "@/lib/motor-screenshot-analysis-config"
import { groupByDate } from "@/lib/motor-screenshot-analysis-data"
import {
  analyseUpload,
  confirmTextImport,
  confirmUpload,
  createTextImports,
  deleteTextImport,
  getUpload,
  getTextImport,
  loadMotors,
  loadRecords,
  loadSummary,
  parseTextImport,
  rejectTextImport,
  rejectUpload,
  updateReviewMessage,
  uploadScreenshots,
  type RecordsResponse,
} from "@/lib/motor-screenshot-analysis-api"
import type { Motor, MotorId, ReviewMessage, RunRecord, UploadDetail } from "@/lib/motor-screenshot-analysis-types"
import { formatDateRange } from "@/lib/motor-screenshot-analysis-format"
import { AnalysisPageHeader } from "@/components/motor-screenshot-analysis/analysis-page-header"
import type { SelectedScreenshotInput, UploadWorkflowState } from "@/components/motor-screenshot-analysis/screenshot-upload-panel"
import { SourceInputPanel, type TextImportInput } from "@/components/motor-screenshot-analysis/source-input-panel"
import { AnalysisReviewPanel } from "@/components/motor-screenshot-analysis/analysis-review-panel"
import { ProcessingLogicNote } from "@/components/motor-screenshot-analysis/processing-logic-note"
import { AnalysisSummaryCards } from "@/components/motor-screenshot-analysis/analysis-summary-cards"
import { MotorSummaryCard } from "@/components/motor-screenshot-analysis/motor-summary-card"
import { AnalysisFilters, DEFAULT_FILTERS, resolveDateRange, type Filters } from "@/components/motor-screenshot-analysis/analysis-filters"
import { DateRuntimeGroup } from "@/components/motor-screenshot-analysis/date-runtime-group"
import { RuntimeRecordsTable, type RecordSort } from "@/components/motor-screenshot-analysis/runtime-records-table"
import { ScreenshotViewer } from "@/components/motor-screenshot-analysis/screenshot-viewer"

const EMPTY_PAGINATION = { page: 1, page_size: 20, total: 0, pages: 0 }

export default function ScreenshotAnalysisPage() {
  const [motors, setMotors] = useState<Motor[]>(FALLBACK_MOTORS)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [records, setRecords] = useState<RunRecord[]>([])
  const [pagination, setPagination] = useState<RecordsResponse["pagination"]>(EMPTY_PAGINATION)
  const [sort, setSort] = useState<RecordSort>("date_desc")
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof loadSummary>> | null>(null)
  const [activeRecord, setActiveRecord] = useState<RunRecord | null>(null)
  const [activeUpload, setActiveUpload] = useState<UploadDetail | null>(null)
  const [reviewQueue, setReviewQueue] = useState<UploadDetail[]>([])
  const [workflowState, setWorkflowState] = useState<UploadWorkflowState>("idle")
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyReview, setBusyReview] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const recordsRef = useRef<HTMLDivElement>(null)
  const range = resolveDateRange(filters)

  useEffect(() => {
    loadMotors().then(setMotors).catch(() => setMotors(FALLBACK_MOTORS))
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [nextRecords, nextSummary] = await Promise.all([
        loadRecords({
          ...range,
          motorId: filters.motor,
          source: filters.source,
          status: filters.status,
          search: filters.search,
          sort,
          page: pagination.page,
          pageSize: pagination.page_size,
        }),
        loadSummary({ ...range, motorId: filters.motor }),
      ])
      setRecords(nextRecords.records)
      setPagination(nextRecords.pagination)
      setSummary(nextSummary)
      setDataError(null)
    } catch (error) {
      setRecords([])
      setSummary(null)
      setDataError(error instanceof Error ? error.message : "Unable to load motor screenshot records.")
    } finally {
      setLoading(false)
    }
  }, [filters, pagination.page, pagination.page_size, range.endDate, range.startDate, sort])

  useEffect(() => {
    const timer = window.setTimeout(refresh, filters.search ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [refresh, filters.search])

  const dateGroups = useMemo(() => groupByDate(records), [records])
  const motorSummaries = summary?.motors ?? motors.map((motor) => ({
    motor,
    totalSeconds: 0,
    totalMinutes: 0,
    completeRuns: 0,
    firstRunTime: null,
    lastRunTime: null,
    rtcOperations: 0,
    phoneOperations: 0,
    unmatched: 0,
  }))

  function changeFilters(next: Filters) {
    setFilters(next)
    setPagination((current) => ({ ...current, page: 1 }))
  }

  function viewMotorRecords(motorId: MotorId) {
    changeFilters({ ...filters, motor: motorId })
    recordsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  async function handleAnalyse(images: SelectedScreenshotInput[]) {
    setWorkflowState("uploading")
    setWorkflowMessage("Uploading screenshots to private MFMS storage…")
    const groups = new Map<MotorId, SelectedScreenshotInput[]>()
    for (const image of images) groups.set(image.motorId, [...(groups.get(image.motorId) ?? []), image])
    let duplicateCount = 0
    let lastDetail: UploadDetail | null = null
    try {
      for (const [motorId, group] of groups) {
        const uploaded = await uploadScreenshots(motorId, group.map((image) => image.file))
        duplicateCount += uploaded.duplicates.length
        for (const upload of uploaded.uploads) {
          setWorkflowState("analysing")
          setWorkflowMessage(`Analysing ${upload.original_filename}…`)
          try {
            lastDetail = await analyseUpload(upload.id)
          } catch (error) {
            lastDetail = await getUpload(upload.id)
            setWorkflowMessage(error instanceof Error ? error.message : "Extraction is unavailable.")
          }
        }
      }
      if (lastDetail) {
        setActiveUpload(lastDetail)
        setReviewQueue([lastDetail])
        setWorkflowState(lastDetail.upload.analysis_status)
        if (!lastDetail.upload.error_message) {
          setWorkflowMessage(`${lastDetail.messages.length} candidates are ready for owner review${duplicateCount ? `; ${duplicateCount} duplicate file(s) skipped` : ""}.`)
        }
      } else {
        setWorkflowState(duplicateCount ? "queued" : "failed")
        setWorkflowMessage(duplicateCount ? `${duplicateCount} duplicate file(s) were safely skipped.` : "No upload was created.")
      }
    } catch (error) {
      setWorkflowState("failed")
      setWorkflowMessage(error instanceof Error ? error.message : "Screenshot upload failed.")
    }
  }

  async function handleTextImport(input: TextImportInput) {
    setWorkflowState("uploading")
    setWorkflowMessage("Importing text into the private MFMS review workflow…")
    let lastDetail: UploadDetail | null = null
    const parsedDetails: UploadDetail[] = []
    try {
      const created = await createTextImports(input.motorId, { rawText: input.rawText, files: input.files })
      for (const item of created.imports) {
        setWorkflowState("analysing")
        setWorkflowMessage(`Parsing ${item.original_filename}…`)
        lastDetail = await parseTextImport(item.id)
        parsedDetails.push(lastDetail)
      }
      if (lastDetail) {
        setActiveUpload(parsedDetails[0])
        setReviewQueue(parsedDetails)
        setWorkflowState(parsedDetails[0].upload.analysis_status)
        const recordCount = parsedDetails.reduce((sum, detail) => sum + detail.messages.length, 0)
        setWorkflowMessage(`${recordCount} MOTOR/MTR records from ${parsedDetails.length} import(s) are ready for owner review${created.duplicates.length ? `; ${created.duplicates.length} duplicate import(s) skipped` : ""}.`)
      } else {
        setWorkflowState(created.duplicates.length ? "queued" : "failed")
        setWorkflowMessage(created.duplicates.length ? `${created.duplicates.length} duplicate import(s) were safely skipped.` : "No text import was created.")
      }
    } catch (error) {
      setWorkflowState("failed")
      setWorkflowMessage(error instanceof Error ? error.message : "Text import failed.")
    }
  }

  async function reloadActive() {
    if (!activeUpload) throw new Error("No active import is selected.")
    return activeUpload.upload.source_type === "screenshot"
      ? getUpload(activeUpload.upload.id)
      : getTextImport(activeUpload.upload.id)
  }

  function storeReviewDetail(detail: UploadDetail) {
    setActiveUpload(detail)
    setReviewQueue((current) => current.map((item) => item.upload.id === detail.upload.id ? detail : item))
  }

  async function saveMessages(messages: ReviewMessage[]) {
    if (!activeUpload) return
    setBusyReview(true)
    try {
      await Promise.all(messages.map(updateReviewMessage))
      storeReviewDetail(await reloadActive())
      setWorkflowMessage("Corrections saved. Review them before confirmation.")
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : "Corrections could not be saved.")
    } finally {
      setBusyReview(false)
    }
  }

  async function confirmMessages(messages: ReviewMessage[]) {
    if (!activeUpload) return
    setBusyReview(true)
    try {
      await Promise.all(messages.map(updateReviewMessage))
      if (activeUpload.upload.source_type === "screenshot") await confirmUpload(activeUpload.upload.id)
      else await confirmTextImport(activeUpload.upload.id)
      const detail = await reloadActive()
      storeReviewDetail(detail)
      setWorkflowState(detail.upload.analysis_status)
      setWorkflowMessage("Owner-confirmed messages were paired transactionally and saved.")
      await refresh()
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : "Confirmation failed.")
    } finally {
      setBusyReview(false)
    }
  }

  async function rejectAnalysis() {
    if (!activeUpload) return
    setBusyReview(true)
    try {
      if (activeUpload.upload.source_type === "screenshot") await rejectUpload(activeUpload.upload.id)
      else await rejectTextImport(activeUpload.upload.id)
      storeReviewDetail(await reloadActive())
      setWorkflowState("rejected")
      setWorkflowMessage(`${activeUpload.upload.source_type === "screenshot" ? "Analysis" : "Import"} rejected. It does not affect runtime totals.`)
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : "Analysis could not be rejected.")
    } finally {
      setBusyReview(false)
    }
  }

  async function reanalyse() {
    if (!activeUpload) return
    setBusyReview(true)
    setWorkflowState("analysing")
    try {
      storeReviewDetail(activeUpload.upload.source_type === "screenshot"
        ? await analyseUpload(activeUpload.upload.id)
        : await parseTextImport(activeUpload.upload.id))
      setWorkflowState("awaiting_review")
      setWorkflowMessage("Reanalysis completed; inspect every candidate again.")
    } catch (error) {
      storeReviewDetail(await reloadActive())
      setWorkflowState("failed")
      setWorkflowMessage(error instanceof Error ? error.message : "Reanalysis failed.")
    } finally {
      setBusyReview(false)
    }
  }

  async function deleteImport() {
    if (!activeUpload || activeUpload.upload.source_type === "screenshot") return
    setBusyReview(true)
    try {
      await deleteTextImport(activeUpload.upload.id)
      const remaining = reviewQueue.filter((item) => item.upload.id !== activeUpload.upload.id)
      setReviewQueue(remaining)
      setActiveUpload(remaining[0] ?? null)
      setWorkflowState(remaining[0]?.upload.analysis_status ?? "idle")
      setWorkflowMessage("Text import deleted. Unconfirmed records do not affect runtime totals.")
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : "Text import could not be deleted.")
    } finally {
      setBusyReview(false)
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />
        <AnalysisPageHeader />
        <div className="flex flex-col gap-4">
          <SourceInputPanel motors={motors} state={workflowState} message={workflowMessage} onTextImport={handleTextImport} onScreenshotAnalyse={handleAnalyse} />
          <ProcessingLogicNote />
        </div>
        {reviewQueue.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3" aria-label="Imports awaiting review">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imports awaiting review</span>
            {reviewQueue.map((detail) => <button key={detail.upload.id} type="button" onClick={() => setActiveUpload(detail)} className={`rounded-full border px-3 py-1 text-xs ${activeUpload?.upload.id === detail.upload.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{detail.upload.original_filename} · {detail.messages.length} records</button>)}
          </div>
        )}
        {activeUpload && (
          <AnalysisReviewPanel detail={activeUpload} motors={motors} busy={busyReview} onSave={saveMessages} onConfirm={confirmMessages} onReject={rejectAnalysis} onReanalyse={reanalyse} onDelete={deleteImport} />
        )}
        {dataError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{dataError}</div>}
        <Panel title="Runtime summary" icon={CalendarRange} headerRight={<span className="text-xs font-medium normal-case tracking-normal text-muted-foreground">Selected period: {formatDateRange(range.startDate, range.endDate)}</span>}>
          <AnalysisSummaryCards
            periodLabel={formatDateRange(range.startDate, range.endDate)}
            motorSummaries={motorSummaries}
            combinedMinutes={Math.round((summary?.combinedSeconds ?? 0) / 60)}
            screenshotsProcessed={summary?.screenshotsProcessed ?? 0}
            completeRuns={summary?.completeRuns ?? 0}
            unmatched={summary?.unmatched ?? 0}
          />
        </Panel>
        <Panel title="Motor-wise summary" icon={Gauge}><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{motorSummaries.map((item) => <MotorSummaryCard key={item.motor.id} summary={item} onViewRecords={viewMotorRecords} />)}</div></Panel>
        <AnalysisFilters filters={filters} onChange={changeFilters} resultCount={pagination.total} motors={motors} />
        <Panel title="Date-wise runtime" icon={CalendarRange} headerRight={<span className="text-xs font-medium normal-case tracking-normal text-muted-foreground">Records on the current result page; exact seconds are summed before display rounding.</span>}>
          {loading ? <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading confirmed records…</p> : <div className="flex flex-col gap-3">{dateGroups.map((group, index) => <DateRuntimeGroup key={group.date} summary={group} defaultOpen={index === 0} onViewScreenshot={setActiveRecord} motors={motors} />)}{dateGroups.length === 0 && <p className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No confirmed or review records in this period.</p>}</div>}
        </Panel>
        <div ref={recordsRef} className="scroll-mt-4">
          <RuntimeRecordsTable
            records={records}
            pagination={pagination}
            sort={sort}
            onSort={(next) => { setSort(next); setPagination((current) => ({ ...current, page: 1 })) }}
            onPage={(page) => setPagination((current) => ({ ...current, page }))}
            onPageSize={(pageSize) => setPagination((current) => ({ ...current, page: 1, page_size: pageSize }))}
            onViewScreenshot={setActiveRecord}
          />
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4"><Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" /><p className="text-sm leading-relaxed text-muted-foreground">Text imports use deterministic parsing and the same owner review, pairing and runtime logic as optional screenshot OCR. Uncertain candidates never affect totals until the owner reviews, corrects and confirms them. Google Vision remains disabled.</p></div>
      </div>
      <ScreenshotViewer record={activeRecord} onClose={() => setActiveRecord(null)} />
    </DashboardShell>
  )
}
