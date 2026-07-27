'use client'

import { AlertTriangle } from 'lucide-react'
import type { DuplicateWarning as DuplicateWarningType } from '@/lib/harvest-live-counter-mock'

interface DuplicateWarningProps {
  warning: DuplicateWarningType | null
}

export function DuplicateWarning({ warning }: DuplicateWarningProps) {
  if (!warning || warning.count === 0) {
    return null
  }

  return (
    <div className="rounded-lg border-l-4 border-l-yellow-400 bg-yellow-50 px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-600 sm:h-6 sm:w-6" />
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-900 text-sm sm:text-base">
            Possible duplicate tree entries: {warning.count}
          </h3>
          <p className="mt-1 text-xs text-yellow-800 sm:text-sm">
            Tree numbers: {warning.treeNumbers.join(', ')}
          </p>
          <button className="mt-3 inline-flex rounded bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-900 hover:bg-yellow-200 sm:px-4 sm:py-2">
            View Entries
          </button>
        </div>
      </div>
    </div>
  )
}
