'use client'

import { CheckCircle2, MapPin, Loader2 } from 'lucide-react'

interface LiveSessionSummaryProps {
  totalCoconuts: number
  lastEntryGrade: 'A' | 'B' | null
  lastEntryValue: number
  lastEntryTime: string
  entriesCount: number
  gpsStatus: boolean
  unsyncedCount: number
}

export function LiveSessionSummary({
  totalCoconuts,
  lastEntryGrade,
  lastEntryValue,
  lastEntryTime,
  entriesCount,
  gpsStatus,
  unsyncedCount,
}: LiveSessionSummaryProps) {
  const gradeColor = lastEntryGrade === 'A' ? 'text-green-700' : 'text-blue-700'
  const gradeBg = lastEntryGrade === 'A' ? 'bg-green-50' : 'bg-blue-50'
  const gradeBorder = lastEntryGrade === 'A' ? 'border-l-4 border-green-600' : 'border-l-4 border-blue-600'

  return (
    <div className={`${gradeBg} ${gradeBorder} rounded-lg p-3 flex flex-col gap-2`}>
      {/* Total Coconuts */}
      <div className="text-center">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
          Total Coconuts
        </p>
        <p className="text-5xl font-bold text-gray-900">{totalCoconuts}</p>
      </div>

      {/* Last Entry */}
      {lastEntryGrade ? (
        <div className="bg-white/60 rounded px-2 py-1.5 text-center">
          <p className="text-xs text-gray-600 mb-0.5">LAST ENTRY</p>
          <p className={`text-sm font-bold ${gradeColor}`}>
            GRADE {lastEntryGrade} +{lastEntryValue} RECORDED
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{lastEntryTime}</p>
        </div>
      ) : (
        <div className="bg-white/60 rounded px-2 py-1.5 text-center">
          <p className="text-xs text-gray-600">NO ENTRIES YET</p>
        </div>
      )}

      {/* Status Row */}
      <div className="flex items-center justify-around gap-1 pt-1 border-t border-gray-300/50">
        <div className="flex items-center gap-1 text-xs">
          <Loader2 className="h-3 w-3 text-gray-600" />
          <span className="text-gray-700 font-medium">{entriesCount}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <MapPin className={`h-3 w-3 ${gpsStatus ? 'text-green-600' : 'text-red-600'}`} />
          <span className={`font-medium ${gpsStatus ? 'text-green-700' : 'text-red-700'}`}>
            {gpsStatus ? '✓' : '✗'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <CheckCircle2 className={`h-3 w-3 ${unsyncedCount === 0 ? 'text-green-600' : 'text-yellow-600'}`} />
          <span className={`font-medium ${unsyncedCount === 0 ? 'text-green-700' : 'text-yellow-700'}`}>
            {unsyncedCount}
          </span>
        </div>
      </div>
    </div>
  )
}
