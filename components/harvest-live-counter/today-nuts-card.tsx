'use client'

import {
  getCompletionPercentage,
  getNutsRemaining,
  formatIndianNumber,
} from '@/lib/harvest-live-counter-mock'

interface TodayNutsCardProps {
  todayNuts: number
  targetNuts: number
}

export function TodayNutsCard({ todayNuts, targetNuts }: TodayNutsCardProps) {
  const percentage = getCompletionPercentage({ todayNuts, targetNuts, submissionCount: 1 } as any)
  const remaining = getNutsRemaining({ todayNuts, targetNuts, submissionCount: 1 } as any)
  const progressWidth = Math.min(percentage, 100)

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Label */}
        <div className="text-xs font-semibold uppercase tracking-widest text-amber-900 sm:text-sm">
          Today's Nuts
        </div>

        {/* Large Number */}
        <div className="text-6xl font-bold text-gray-900 sm:text-7xl lg:text-8xl">
          {formatIndianNumber(todayNuts)}
        </div>

        {/* Target and Percentage */}
        <div className="flex items-baseline justify-between gap-4">
          <div className="text-sm text-gray-700 sm:text-base">
            Target: {formatIndianNumber(targetNuts)}
          </div>
          <div className="text-base font-semibold text-amber-900 sm:text-lg">
            {percentage}%
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        {/* Remaining */}
        <div className="text-sm text-gray-600 sm:text-base">
          {remaining > 0 ? (
            <>
              Remaining: <span className="font-semibold text-gray-900">{formatIndianNumber(remaining)}</span>
            </>
          ) : (
            <>
              Exceeded: <span className="font-semibold text-red-600">{formatIndianNumber(Math.abs(remaining))}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
