'use client'

import { Download } from 'lucide-react'

interface ExportConfirmationDialogProps {
  isOpen: boolean
  date: string
  onCancel: () => void
  onConfirm: () => void
}

export function ExportConfirmationDialog({
  isOpen,
  date,
  onCancel,
  onConfirm,
}: ExportConfirmationDialogProps) {
  if (!isOpen) return null

  const fileName = `Coconut_Counting_${date}.xlsx`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ width: '412px', height: '915px' }}>
      <div className="bg-white rounded-xl p-6 max-w-xs mx-2 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-bold text-gray-900">EXPORT TO EXCEL</h2>
        </div>
        <p className="text-sm text-gray-700 mb-2">
          Export all count entries and totals for:
        </p>
        <p className="text-sm font-semibold text-gray-900 mb-4">{date}</p>
        <div className="bg-gray-50 rounded p-3 mb-5">
          <p className="text-xs text-gray-600 mb-1">File name:</p>
          <p className="text-xs font-mono text-gray-900 break-all">{fileName}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold py-3 px-4 rounded-lg transition-colors text-sm"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            EXPORT
          </button>
        </div>
      </div>
    </div>
  )
}
