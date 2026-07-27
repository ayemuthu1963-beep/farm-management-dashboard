/**
 * Live session summary card - centre of main counting screen
 * Shows total coconuts, last entry, entries count, GPS status, sync count
 */

interface LiveSessionSummaryProps {
  totalCoconuts: number
  lastEntryGrade?: string
  lastEntryValue?: number
  lastEntryTime?: string
  entriesCount: number
  gpsActive: boolean
  unsynced: number
}

export function LiveSessionSummary({
  totalCoconuts,
  lastEntryGrade,
  lastEntryValue,
  lastEntryTime,
  entriesCount,
  gpsActive,
  unsynced,
}: LiveSessionSummaryProps) {
  return (
    <div className="w-full border-4 border-green-500 rounded-2xl bg-gradient-to-b from-green-50 to-white px-4 py-4">
      {/* Total coconuts section */}
      <div className="text-center mb-4">
        <p className="text-xs font-semibold text-gray-600 mb-1">TOTAL COCONUTS</p>
        <p className="text-4xl font-black text-gray-900">{totalCoconuts}</p>
      </div>

      {/* Last entry info */}
      {lastEntryGrade && (
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 mb-3 text-center">
          <p className="text-xs text-gray-600 font-semibold mb-1">LAST ENTRY</p>
          <p className="text-sm font-bold text-green-700">
            GRADE {lastEntryGrade} +{lastEntryValue} RECORDED
          </p>
          <p className="text-xs text-gray-600">{lastEntryTime}</p>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-around text-xs font-semibold px-2 py-2 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-1">
          <span className="text-base">🕐</span>
          <span className="text-gray-700">Entries {entriesCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-base">{gpsActive ? '📍' : '❌'}</span>
          <span className={gpsActive ? 'text-green-700' : 'text-gray-500'}>
            GPS {gpsActive ? '✓' : '✗'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-base">☁️</span>
          <span className="text-gray-700">Sync {unsynced}</span>
        </div>
      </div>
    </div>
  )
}
