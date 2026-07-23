'use client'

import { formatIndianNumber, type PreviousHarvestDay } from '@/lib/harvest-live-counter-mock'

interface PreviousHarvestDaysProps {
  days: PreviousHarvestDay[]
}

export function PreviousHarvestDays({ days }: PreviousHarvestDaysProps) {
  if (days.length === 0) {
    return null
  }

  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-900">
        Previous Harvest Days
      </h2>
      <div className="space-y-2">
        {days.map((day) => (
          <div
            key={day.date}
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm sm:px-6 sm:py-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-semibold text-gray-900">{day.date}</span>
              <span className="text-gray-600">
                Trees: {formatIndianNumber(day.trees)} | Bunches: {formatIndianNumber(day.bunches)} | Nuts:{' '}
                {formatIndianNumber(day.nuts)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
