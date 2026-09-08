"use client"

import { useState } from "react"
import { Download, LoaderCircle } from "lucide-react"
import type { BeetleTrapMatrix } from "@/lib/beetle-trap-matrix"
import {
  beetleTrapMatrixWorkbookFilename,
  buildBeetleTrapMatrixWorkbook,
} from "@/lib/beetle-trap-matrix-excel"

interface BeetleTrapMatrixExcelExportProps {
  matrix: BeetleTrapMatrix
}

export function BeetleTrapMatrixExcelExport({ matrix }: BeetleTrapMatrixExcelExportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState(false)

  function exportToExcel() {
    if (isExporting || matrix.traps.length === 0) return

    setIsExporting(true)
    setExportError(false)
    try {
      const workbook = buildBeetleTrapMatrixWorkbook(matrix)
      const url = URL.createObjectURL(workbook)
      const link = document.createElement("a")
      link.href = url
      link.download = beetleTrapMatrixWorkbookFilename()
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      setExportError(true)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={exportToExcel}
        disabled={isExporting || matrix.traps.length === 0}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold normal-case tracking-normal text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isExporting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
        {isExporting ? "Preparing Excel…" : "Export to Excel"}
      </button>
      {exportError ? <p className="text-xs font-medium normal-case tracking-normal text-destructive" role="alert">Unable to prepare the Excel file. Please try again.</p> : null}
    </div>
  )
}
