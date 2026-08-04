"use client"

import { useEffect, useRef, useState } from "react"
import { ImageIcon, Trash2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FALLBACK_MOTORS } from "@/lib/motor-screenshot-analysis-config"
import type { AnalysisStatus, Motor, MotorId } from "@/lib/motor-screenshot-analysis-types"
import { MotorBadge } from "./motor-badge"

export type UploadWorkflowState = "idle" | "ready" | "uploading" | AnalysisStatus

export interface SelectedScreenshotInput {
  id: string
  file: File
  motorId: MotorId
  motorName: string
  previewUrl: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function stateLabel(state: UploadWorkflowState): string {
  return {
    idle: "No screenshots selected",
    ready: "Ready to upload",
    uploading: "Uploading",
    queued: "Queued",
    analysing: "Analysing",
    awaiting_review: "Awaiting review",
    confirmed: "Confirmed",
    partially_confirmed: "Partially confirmed",
    failed: "Failed",
    rejected: "Rejected",
  }[state]
}

export function ScreenshotUploadPanel({
  motors = FALLBACK_MOTORS,
  state,
  message,
  onAnalyse,
  disabled = false,
}: {
  motors?: Motor[]
  state: UploadWorkflowState
  message?: string | null
  onAnalyse: (images: SelectedScreenshotInput[]) => Promise<void>
  disabled?: boolean
}) {
  const [motorId, setMotorId] = useState<MotorId>(motors[0]?.id ?? "motor-1")
  const [images, setImages] = useState<SelectedScreenshotInput[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const imagesRef = useRef<SelectedScreenshotInput[]>([])
  const busy = disabled || state === "uploading" || state === "analysing"

  imagesRef.current = images
  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl)), [])

  function addFiles(files: FileList | null) {
    if (!files || disabled) return
    const motor = motors.find((item) => item.id === motorId) ?? motors[0]
    if (!motor) return
    const next = Array.from(files)
      .filter((file) => /image\/(png|jpe?g)/.test(file.type))
      .map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        motorId: motor.id,
        motorName: motor.name,
        previewUrl: URL.createObjectURL(file),
      }))
    setImages((current) => [...current, ...next].slice(0, 20))
  }

  function removeImage(id: string) {
    setImages((current) => {
      const target = current.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((item) => item.id !== id)
    })
  }

  function clearAll() {
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl))
    setImages([])
  }

  async function submit() {
    await onAnalyse(images)
  }

  return (
    <section aria-labelledby="upload-heading" className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="upload-heading" className="font-serif text-lg font-bold text-foreground">Upload screenshots</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {disabled
              ? "PNG, JPG and JPEG support is preserved for optional later activation; uploads are currently disabled."
              : "PNG, JPG and JPEG only. Images are sent through the authenticated MFMS route to private storage."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="motor-select" className="text-sm font-medium text-foreground">Motor</label>
          <select
            id="motor-select"
            value={motorId}
            onChange={(event) => setMotorId(event.target.value as MotorId)}
            disabled={busy}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {motors.map((motor) => <option key={motor.id} value={motor.id}>{motor.name}</option>)}
          </select>
        </div>
      </div>

      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragging ? "border-primary bg-accent/50" : "border-border bg-muted/40",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-primary">
          <Upload className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Drag and drop screenshots here</p>
          <p className="text-xs text-muted-foreground">New selections will be assigned to {motors.find((motor) => motor.id === motorId)?.name}.</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          Select Screenshots
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          disabled={disabled}
          className="sr-only"
          aria-label="Select screenshot images"
          onChange={(event) => { addFiles(event.target.files); event.target.value = "" }}
        />
      </div>

      {images.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{images.length} image{images.length === 1 ? "" : "s"} selected</p>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={clearAll}>
              <Trash2 className="size-4" aria-hidden="true" /> Clear All
            </Button>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <li key={image.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.previewUrl} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground" title={image.file.name}>{image.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(image.file.size)}</p>
                  <MotorBadge motorId={image.motorId} name={image.motorName} className="mt-1" />
                </div>
                <button type="button" disabled={busy} onClick={() => removeImage(image.id)} aria-label={`Remove ${image.file.name}`} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={submit} disabled={images.length === 0 || busy}>
          <ImageIcon className="size-4" aria-hidden="true" />
          {busy ? `${stateLabel(state)}…` : "Analyse Screenshots"}
        </Button>
        <span className={cn("text-sm", state === "failed" ? "text-destructive" : "text-muted-foreground")} role="status">
          {message ?? stateLabel(images.length > 0 && state === "idle" ? "ready" : state)}
        </span>
      </div>
    </section>
  )
}
