/**
 * Reset confirmation dialog
 * Warns user that totals will reset but history is preserved
 */

interface ResetConfirmationDialogProps {
  isOpen: boolean
  onCancel?: () => void
  onConfirm?: () => void
}

export function ResetConfirmationDialog({
  isOpen,
  onCancel,
  onConfirm,
}: ResetConfirmationDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">RESET CURRENT COUNT?</h2>

        <div className="space-y-3 mb-6">
          <p className="text-sm text-gray-700">
            Current Grade A, Grade B and A+B totals will return to zero.
          </p>
          <p className="text-sm text-gray-700">
            Today&apos;s previous entries and past-day history will remain saved.
          </p>
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
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            RESET
          </button>
        </div>
      </div>
    </div>
  )
}
