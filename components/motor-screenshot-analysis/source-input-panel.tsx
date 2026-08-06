"use client"

import { useMemo, useRef, useState } from "react"
import { Clipboard, FileSpreadsheet, FileText, ImageIcon, Trash2, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FALLBACK_MOTORS, MOTOR_TEXT_SAMPLE, SCREENSHOT_OCR_ENABLED } from "@/lib/motor-screenshot-analysis-config"
import type { Motor, MotorId } from "@/lib/motor-screenshot-analysis-types"
import { cn } from "@/lib/utils"
import { ScreenshotUploadPanel, type SelectedScreenshotInput, type UploadWorkflowState } from "./screenshot-upload-panel"

type InputMethod = "paste" | "txt" | "excel" | "screenshot"

export type TextImportInput = { motorId: MotorId; rawText?: string; files?: File[] }
export type ExcelImportInput = { motorId: MotorId; files: File[] }

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function detectedRecordCount(text: string) {
  return text.split(/\r?\n/).filter((line) => (
    /^\s*(MOTOR|MTR)/i.test(line)
    || /\|\s*(MOTOR|MTR)/i.test(line)
  )).length
}

export function SourceInputPanel({
  motors = FALLBACK_MOTORS,
  state,
  message,
  onTextImport,
  onExcelImport,
  onScreenshotAnalyse,
}: {
  motors?: Motor[]
  state: UploadWorkflowState
  message?: string | null
  onTextImport: (input: TextImportInput) => Promise<void>
  onExcelImport: (input: ExcelImportInput) => Promise<void>
  onScreenshotAnalyse: (images: SelectedScreenshotInput[]) => Promise<void>
}) {
  const [method, setMethod] = useState<InputMethod>("paste")
  const [motorId, setMotorId] = useState<MotorId>(motors[0]?.id ?? "motor-1")
  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [excelFiles, setExcelFiles] = useState<File[]>([])
  const [previewFile, setPreviewFile] = useState<{ name: string; text: string } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const excelInputRef = useRef<HTMLInputElement>(null)
  const busy = state === "uploading" || state === "analysing"
  const motorName = motors.find((motor) => motor.id === motorId)?.name ?? motorId
  const count = useMemo(() => detectedRecordCount(text), [text])

  function addTextFiles(list: FileList | null) {
    if (!list) return
    const selected = Array.from(list)
    const invalidType = selected.find((file) => !file.name.toLowerCase().endsWith(".txt"))
    const oversized = selected.find((file) => file.size > 1024 * 1024)
    if (invalidType) setFileError(`${invalidType.name} is not a .txt file.`)
    else if (oversized) setFileError(`${oversized.name} exceeds the 1 MiB limit.`)
    else if (files.length + selected.length > 10) setFileError("No more than 10 TXT files may be imported at once.")
    else setFileError(null)
    const accepted = selected.filter((file) => file.name.toLowerCase().endsWith(".txt") && file.size <= 1024 * 1024)
    setFiles((current) => [...current, ...accepted].slice(0, 10))
  }

  function addExcelFiles(list: FileList | null) {
    if (!list) return
    const selected = Array.from(list)
    const invalidType = selected.find((file) => !file.name.toLowerCase().endsWith(".xlsx"))
    const oversized = selected.find((file) => file.size > 5 * 1024 * 1024)
    if (invalidType) setFileError(`${invalidType.name} is not a macro-free .xlsx file.`)
    else if (oversized) setFileError(`${oversized.name} exceeds the 5 MiB limit.`)
    else if (excelFiles.length + selected.length > 10) setFileError("No more than 10 Excel files may be imported at once.")
    else setFileError(null)
    const accepted = selected.filter((file) => file.name.toLowerCase().endsWith(".xlsx") && file.size <= 5 * 1024 * 1024)
    setExcelFiles((current) => [...current, ...accepted].slice(0, 10))
  }

  async function preview(file: File) {
    setPreviewFile({ name: file.name, text: await file.text() })
  }

  async function copySample() {
    await navigator.clipboard.writeText(MOTOR_TEXT_SAMPLE)
  }

  return (
    <section aria-labelledby="input-method-heading" className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div>
        <h2 id="input-method-heading" className="font-serif text-lg font-bold text-foreground">Import motor notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">Import an Excel history, paste full text, or upload TXT. Every result is reviewed before it affects runtime totals.</p>
      </div>

      <div role="tablist" aria-label="Input method" className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {([
          ["paste", "Paste Full Text", Clipboard],
          ["txt", "Upload TXT File", FileText],
          ["excel", "Upload Excel", FileSpreadsheet],
          ["screenshot", "Upload Screenshot — Optional", ImageIcon],
        ] as const).map(([value, label, Icon]) => (
          <button key={value} type="button" role="tab" aria-selected={method === value} onClick={() => setMethod(value)} className={cn("flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium", method === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground")}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {method !== "screenshot" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="text-sm font-medium text-foreground">Select Motor
            <select value={motorId} onChange={(event) => setMotorId(event.target.value as MotorId)} disabled={busy} className="ml-2 rounded-lg border border-input bg-background px-3 py-2 text-sm">
              {motors.map((motor) => <option key={motor.id} value={motor.id}>{motor.name}</option>)}
            </select>
          </label>
          {method !== "excel" && <Button type="button" variant="outline" size="sm" onClick={copySample}>Copy Sample Format</Button>}
        </div>
      )}

      {method === "paste" && (
        <div className="mt-4">
          <label htmlFor="motor-notification-text" className="text-sm font-semibold text-foreground">Paste Motor Notification Text</label>
          <textarea id="motor-notification-text" value={text} onChange={(event) => setText(event.target.value)} rows={13} maxLength={1024 * 1024} placeholder="30/07/2026 09:14:10 | MOTOR ON BECAUSE OF RTC ON TIME" className="mt-2 w-full resize-y rounded-xl border border-input bg-background p-3 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{text.length.toLocaleString()} characters · {count} detected MOTOR/MTR record{count === 1 ? "" : "s"}</span>
            <span>Most reliable: DD/MM/YYYY HH:MM:SS | MOTOR/MTR message</span>
          </div>
          {fileError && <p role="alert" className="mt-2 text-sm text-destructive">{fileError}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Scanner layouts with the message, date and time on nearby lines are also accepted. Records without exact seconds will require owner correction.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" disabled={busy || !text.trim()} onClick={() => onTextImport({ motorId, rawText: text })}><Upload className="size-4" /> Import and Review</Button>
            <Button type="button" variant="outline" disabled={busy || !text} onClick={() => setText("")}><Trash2 className="size-4" /> Clear</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setText(MOTOR_TEXT_SAMPLE)}>Load Sample</Button>
          </div>
        </div>
      )}

      {method === "txt" && (
        <div className="mt-4">
          <div className="rounded-xl border-2 border-dashed border-border bg-muted/40 p-6 text-center">
            <FileText className="mx-auto size-8 text-primary" />
            <p className="mt-2 text-sm font-medium text-foreground">UTF-8 .txt files only</p>
            <p className="text-xs text-muted-foreground">Maximum 10 files, 1 MiB each. All selected files are assigned to {motorName}.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" disabled={busy || files.length >= 10} onClick={() => inputRef.current?.click()}>Select TXT Files</Button>
            <input ref={inputRef} type="file" accept=".txt,text/plain" multiple className="sr-only" onChange={(event) => { addTextFiles(event.target.files); event.target.value = "" }} />
          </div>
          {files.length > 0 && <ul className="mt-3 space-y-2">{files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${index}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3">
              <FileText className="size-5 text-muted-foreground" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{formatBytes(file.size)} · {motorName}</p></div>
              <Button type="button" size="sm" variant="ghost" onClick={() => preview(file)}>Preview Text</Button>
              <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X className="size-4" /></Button>
            </li>
          ))}</ul>}
          {previewFile && <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3"><div className="flex justify-between gap-2"><p className="text-sm font-medium">{previewFile.name}</p><Button type="button" size="sm" variant="ghost" onClick={() => setPreviewFile(null)}>Close</Button></div><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs">{previewFile.text}</pre></div>}
          <Button type="button" className="mt-4" disabled={busy || files.length === 0} onClick={() => onTextImport({ motorId, files })}><Upload className="size-4" /> Import and Review</Button>
        </div>
      )}

      {method === "excel" && (
        <div className="mt-4">
          <div className="rounded-xl border-2 border-dashed border-border bg-muted/40 p-6 text-center">
            <FileSpreadsheet className="mx-auto size-8 text-primary" />
            <p className="mt-2 text-sm font-medium text-foreground">Motor notification .xlsx workbooks</p>
            <p className="text-xs text-muted-foreground">Maximum 10 files, 5 MiB each. Macros and formulas are rejected. All rows are assigned to {motorName}.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" disabled={busy || excelFiles.length >= 10} onClick={() => excelInputRef.current?.click()}>Select Excel Files</Button>
            <input ref={excelInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple className="sr-only" onChange={(event) => { addExcelFiles(event.target.files); event.target.value = "" }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Required columns: Tile No, First Line of Tile, Date, Time (HH:MM), and Remarks. Every row is stored in PostgreSQL; only MOTOR/MTR and relevant power evidence enter runtime pairing.</p>
          {fileError && <p role="alert" className="mt-2 text-sm text-destructive">{fileError}</p>}
          {excelFiles.length > 0 && <ul className="mt-3 space-y-2">{excelFiles.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${index}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3">
              <FileSpreadsheet className="size-5 text-muted-foreground" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{formatBytes(file.size)} · {motorName}</p></div>
              <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${file.name}`} onClick={() => setExcelFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X className="size-4" /></Button>
            </li>
          ))}</ul>}
          <Button type="button" className="mt-4" disabled={busy || excelFiles.length === 0} onClick={() => onExcelImport({ motorId, files: excelFiles })}><Upload className="size-4" /> Import Excel and Review</Button>
        </div>
      )}

      {method === "screenshot" && (
        <div className="mt-4">
          {!SCREENSHOT_OCR_ENABLED && <div role="status" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Screenshot OCR is not currently enabled. Use Paste Full Text or Upload TXT File.</div>}
          <ScreenshotUploadPanel motors={motors} state={state} message={message} onAnalyse={onScreenshotAnalyse} disabled={!SCREENSHOT_OCR_ENABLED} />
        </div>
      )}
      {method !== "screenshot" && message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}
    </section>
  )
}
