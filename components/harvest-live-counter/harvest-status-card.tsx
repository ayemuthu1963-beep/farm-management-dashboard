'use client'

import { getNutsExceeded, formatIndianNumber, type HarvestState } from '@/lib/harvest-live-counter-mock'
import { AlertCircle } from 'lucide-react'

interface HarvestStatusCardProps {
  state: HarvestState
  todayNuts: number
  targetNuts: number
  lastUpdated: string
}

export function HarvestStatusCard({
  state,
  todayNuts,
  targetNuts,
  lastUpdated,
}: HarvestStatusCardProps) {
  // In-progress state
  if (state === 'in-progress' || state === 'near-target') {
    return (
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-6 text-center sm:px-8 sm:py-8">
        <div className="text-sm font-semibold uppercase tracking-widest text-amber-900 sm:text-base">
          Harvest In Progress
        </div>
      </div>
    )
  }

  // Target reached state
  if (state === 'target-reached') {
    const exceeded = getNutsExceeded({ todayNuts, targetNuts, submissionCount: 1 } as any)
    return (
      <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-6 text-center sm:px-8 sm:py-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <AlertCircle className="h-5 w-5 text-red-600 sm:h-6 sm:w-6" />
          <div className="text-sm font-bold uppercase tracking-widest text-red-700 sm:text-base">
            Stop Harvest
          </div>
        </div>
        <div className="text-xs font-semibold uppercase tracking-widest text-red-600 sm:text-sm">
          Target Reached
        </div>
        <div className="mt-2 text-sm text-red-700 sm:text-base">
          Target exceeded by {formatIndianNumber(exceeded)} nuts
        </div>
      </div>
    )
  }

  // Empty state
  if (state === 'empty') {
    return (
      <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-6 text-center sm:px-8 sm:py-8">
        <div className="text-sm font-semibold uppercase tracking-widest text-gray-700 sm:text-base">
          Harvest Has Not Started
        </div>
        <div className="mt-2 text-sm text-gray-600 sm:text-base">
          No submissions yet today
        </div>
      </div>
    )
  }

  return null
}
