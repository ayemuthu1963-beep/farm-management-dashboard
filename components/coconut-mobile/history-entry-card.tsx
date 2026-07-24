'use client'

import { CheckCircle2, AlertCircle } from 'lucide-react'

interface HistoryEntryCardProps {
  entryNumber: number
  time: string
  grade: 'A' | 'B'
  type: 'fixed' | 'manual'
  count: number
  gpsLat: string
  gpsLng: string
  gpsAccuracy: string
  runningTotalA: number
  runningTotalB: number
  runningTotalAB: number
  synced: boolean
}

export function HistoryEntryCard({
  entryNumber,
  time,
  grade,
  type,
  count,
  gpsLat,
  gpsLng,
  gpsAccuracy,
  runningTotalA,
  runningTotalB,
  runningTotalAB,
  synced,
}: HistoryEntryCardProps) {
  const isGradeA = grade === 'A'
  const borderColor = isGradeA ? 'border-l-4 border-green-600' : 'border-l-4 border-blue-600'
  const bgColor = isGradeA ? 'bg-green-50' : 'bg-blue-50'

  return (
    <div className={`${bgColor} ${borderColor} rounded-lg p-3 text-xs`}>
      {/* Header: Entry Number, Time */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-gray-900">ENTRY {entryNumber}</span>
        <span className="text-gray-600">{time}</span>
      </div>

      {/* Grade and Type */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-300/50">
        <span className={`font-semibold ${isGradeA ? 'text-green-700' : 'text-blue-700'}`}>
          GRADE {grade} — {type === 'fixed' ? 'FIXED' : 'MANUAL'}
        </span>
        <span className="font-bold text-gray-900">+{count}</span>
      </div>

      {/* GPS */}
      <div className="mb-2 pb-2 border-b border-gray-300/50">
        <p className="font-semibold text-gray-700 mb-1">GPS:</p>
        <p className="text-gray-600">{gpsLat}, {gpsLng}</p>
        <p className="text-gray-600">Accuracy: {gpsAccuracy}</p>
      </div>

      {/* Running Totals */}
      <div className="grid grid-cols-3 gap-1 mb-2 pb-2 border-b border-gray-300/50">
        <div>
          <p className="text-gray-600">Running A:</p>
          <p className="font-bold text-green-700">{runningTotalA}</p>
        </div>
        <div>
          <p className="text-gray-600">Running B:</p>
          <p className="font-bold text-blue-700">{runningTotalB}</p>
        </div>
        <div>
          <p className="text-gray-600">A+B:</p>
          <p className="font-bold text-gray-900">{runningTotalAB}</p>
        </div>
      </div>

      {/* Sync Status */}
      <div className="flex items-center gap-1">
        {synced ? (
          <>
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            <span className="text-green-700 font-semibold">Synced</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-3 w-3 text-yellow-600" />
            <span className="text-yellow-700 font-semibold">Pending</span>
          </>
        )}
      </div>
    </div>
  )
}
