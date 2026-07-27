'use client'

import { X } from 'lucide-react'

interface ResetConfirmationDialogProps {
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ResetConfirmationDialog({
  isOpen,
  onCancel,
  onConfirm,
}: ResetConfirmationDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-gray-200 px-6 py-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            RESET CURRENT COUNT?
          </h2>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 hover:bg-gray-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <p className="text-base text-gray-700">
            This will reset the current Grade A, Grade B, and A+B totals to zero.
          </p>
          <p className="text-base text-gray-700">
            Today's previous entries and past-day history will remain available.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t-2 border-gray-200 px-6 py-4">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border-2 border-gray-300 py-3 font-bold text-gray-700 transition-colors hover:bg-gray-50"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 py-3 font-bold text-white transition-colors hover:bg-red-700"
          >
            RESET CURRENT COUNT
          </button>
        </div>
      </div>
    </div>
  )
}
