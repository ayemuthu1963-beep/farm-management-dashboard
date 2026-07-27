/**
 * History entry card for scrollable lists
 * Shows complete entry details with GPS and running totals
 */

import type { CountEntry } from './types'

interface HistoryEntryCardProps {
  entry: CountEntry
}

export function HistoryEntryCard({ entry }: HistoryEntryCardProps) {
  const isGradeA = entry.grade === 'A'
  const borderColor = isGradeA ? 'border-l-4 border-green-600' : 'border-l-4 border-blue-600'
  const gradeBgColor = isGradeA ? 'bg-green-100' : 'bg-blue-100'
  const gradeTextColor = isGradeA ? 'text-green-800' : 'text-blue-800'
  const countColor = isGradeA ? 'text-green-700' : 'text-blue-700'

  return (
    <div className={`${borderColor} bg-white rounded-lg p-4 space-y-3`}>
      {/* Header row: Entry number, time, grade */}
      <div className="flex items-start justify-between gap-3">
        {/* Entry number badge */}
        <div
          className={`${isGradeA ? 'bg-green-500' : 'bg-blue-500'} text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0`}
        >
          {entry.sequence}
        </div>

        {/* Time */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-600">TIME</p>
          <p className="text-sm font-bold text-gray-900">{entry.time}</p>
        </div>

        {/* Grade badge */}
        <div className={`${gradeBgColor} ${gradeTextColor} px-3 py-1 rounded font-bold text-sm flex-shrink-0`}>
          {entry.grade}
        </div>

        {/* Count value */}
        <div className="text-right">
          <p className="text-xs text-gray-600">COUNT</p>
          <p className={`text-lg font-bold ${countColor}`}>{entry.count}</p>
        </div>
      </div>

      {/* GPS row */}
      <div className="bg-gray-50 rounded p-2">
        <p className="text-xs text-gray-600 font-semibold">GPS (LAT, LONG)</p>
        <p className="text-xs font-mono text-gray-700">{entry.gps.latitude}, {entry.gps.longitude}</p>
        <p className="text-xs text-gray-600 mt-1">ACCURACY: {entry.gps.accuracy}</p>
      </div>

      {/* Type and totals row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-600">TYPE</p>
          <p className="text-sm font-bold text-gray-900 capitalize">{entry.countType}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className={entry.syncStatus === 'synced' ? 'text-green-600' : 'text-yellow-600'}>
            {entry.syncStatus === 'synced' ? '✓' : '⏳'}
          </span>
          <span className="text-xs font-semibold text-gray-700">
            {entry.syncStatus === 'synced' ? 'SYNCED' : 'PENDING'}
          </span>
        </div>
      </div>

      {/* Running totals */}
      <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded p-2">
        <div>
          <p className="text-xs text-gray-600 font-semibold">RUNNING A</p>
          <p className="text-sm font-bold text-green-700">{entry.runningTotalA}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 font-semibold">RUNNING B</p>
          <p className="text-sm font-bold text-blue-700">{entry.runningTotalB}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 font-semibold">RUNNING A+B</p>
          <p className="text-sm font-bold text-teal-700">{entry.runningCombined}</p>
        </div>
      </div>
    </div>
  )
}
