/**
 * Export to Excel confirmation dialog
 * Shows date, filename, and entry count before export
 */

interface ExportConfirmationDialogProps {
  isOpen: boolean
  date: string
  entryCount?: number
  onCancel?: () => void
  onConfirm?: () => void
}

export function ExportConfirmationDialog({
  isOpen,
  date,
  entryCount = 0,
  onCancel,
  onConfirm,
}: ExportConfirmationDialogProps) {
  if (!isOpen) return null

  const filename = `Coconut_Counting_${date.replace(/-/g, '_')}.xlsx`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">EXPORT TO EXCEL</h2>

        <div className="space-y-3 mb-6 bg-gray-50 rounded-lg p-4">
          <div>
            <p className="text-xs text-gray-600 font-semibold">DATE</p>
            <p className="text-sm font-bold text-gray-900">{date}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 font-semibold">FILENAME</p>
            <p className="text-xs font-mono text-gray-700 break-all">{filename}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 font-semibold">ENTRIES</p>
            <p className="text-sm font-bold text-gray-900">{entryCount} entries</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold py-3 px-4 rounded-lg transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>📥</span>
            <span>EXPORT</span>
          </button>
        </div>
      </div>
    </div>
  )
}
