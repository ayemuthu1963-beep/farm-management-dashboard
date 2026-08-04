"use client"

import { useRef, useState } from "react"
import { ImageIcon, Trash2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MOTORS, getMotor } from "@/lib/motor-screenshot-analysis-mock-data"
import type { MotorId } from "@/lib/motor-screenshot-analysis-types"
import { MotorBadge } from "./motor-badge"

type AnalyseState = "idle" | "reading" | "done"

interface SelectedImage {
  id: string
  name: string
  size: number
  motorId: MotorId
  previewUrl: string
}
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ScreenshotUploadPanel({ onAnalyse }: { onAnalyse?: () => void }) {
  const [motorId, setMotorId] = useState<MotorId>("motor-1")
  const [images, setImages] = useState<SelectedImage[]>([])
  const [dragging, setDragging] = useState(false)
  const [analyse, setAnalyse] = useState<AnalyseState>("idle")
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(files: FileList | null) {
    if (!files) return
    const next: SelectedImage[] = Array.from(files)
      .filter((f) => /image\/(png|jpe?g)/.test(f.type))
      .map((f, i) => ({
        id: `${Date.now()}-${i}-${f.name}`,
        name: f.name,
        size: f.size,
        motorId,
        previewUrl: URL.createObjectURL(f),
      }))
    if (next.length > 0) {
      setImages((prev) => [...prev, ...next])
      setAnalyse("idle")
    }
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  function clearAll() {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    setImages([])
    setAnalyse("idle")
  }

  function handleAnalyse() {
    setAnalyse("reading")
    window.setTimeout(() => {
      setAnalyse("done")
      onAnalyse?.()
    }, 1200)
  }

  return (
    <section
      aria-labelledby="upload-heading"
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="upload-heading" className="font-serif text-lg font-bold text-foreground">
            Upload screenshots
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Accepted file types: PNG, JPG and JPEG. Files stay in your browser and are not uploaded.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="motor-select" className="text-sm font-medium text-foreground">
            Motor
          </label>
          <select
            id="motor-select"
            value={motorId}
            onChange={(e) => setMotorId(e.target.value as MotorId)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {MOTORS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragging ? "border-primary bg-accent/50" : "border-border bg-muted/40",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-primary">
          <Upload className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">
            Drag and drop screenshots here
          </p>
          <p className="text-xs text-muted-foreground">
            Assigning to <span className="font-medium text-foreground">{getMotor(motorId).name}</span>
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Select Screenshot
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="sr-only"
          aria-label="Select screenshot images"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {images.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {images.length} image{images.length === 1 ? "" : "s"} selected
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="size-4" aria-hidden="true" />
              Clear All
            </Button>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img) => (
              <li
                key={img.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl || "/placeholder.svg"}
                  alt=""
                  className="size-12 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground" title={img.name}>
                    {img.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatBytes(img.size)}</p>
                  <MotorBadge motorId={img.motorId} className="mt-1" />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  aria-label={`Remove ${img.name}`}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleAnalyse}
          disabled={images.length === 0 || analyse === "reading"}
        >
          <ImageIcon className="size-4" aria-hidden="true" />
          {analyse === "reading" ? "Reading screenshots\u2026" : "Analyse Screenshots"}
        </Button>
        {analyse === "reading" && (
          <span className="text-sm text-muted-foreground" role="status">
            Reading screenshot records&hellip;
          </span>
        )}
        {analyse === "done" && (
          <span className="text-sm font-medium text-primary" role="status">
            Static sample analysis completed.
          </span>
        )}
      </div>
    </section>
  )
}
