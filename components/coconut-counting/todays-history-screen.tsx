/**
 * Today's History Screen
 * Shows today's count entries with GPS info, totals, and export button
 */

'use client'

import { useState } from 'react'
import { CoconutCountingHeader } from './coconut-counting-header'
import { HistorySummaryTiles } from './history-summary-tiles'
import { HistoryEntryCard } from './history-entry-card'
import { ExportConfirmationDialog } from './export-confirmation-dialog'
import { mockTodaysEntries } from './mock-data'

interface TodaysHistoryScreenProps {
  onBack?: () => void
  onExport?: (date: string) => void
}

const mockHistoryDataOld = [
  {
    id: 1,
    date: '23-07-2026',
    time: '09:15:22 AM',
    grade: 'Grade A',
    entryType: 'Fixed 200',
    count: 200,
    location: '11.123456, 77.987654',
    accuracy: '± 6 m',
    runningA: 200,
    runningB: 0,
    runningTotal: 200,
  },
  {
    id: 2,
    date: '23-07-2026',
    time: '09:18:41 AM',
    grade: 'Grade A',
    entryType: 'Manual',
    count: 75,
    location: '11.123500, 77.987700',
    accuracy: '± 5 m',
    runningA: 275,
    runningB: 0,
    runningTotal: 275,
  },
  {
    id: 3,
    date: '23-07-2026',
    time: '09:22:10 AM',
    grade: 'Grade B',
    entryType: 'Fixed 200',
    count: 200,
    location: '11.123600, 77.987800',
    accuracy: '± 7 m',
    runningA: 275,
    runningB: 200,
    runningTotal: 475,
  },
  {
    id: 4,
    date: '23-07-2026',
    time: '09:25:55 AM',
    grade: 'Grade A',
    entryType: 'Manual',
    count: 33,
    location: '11.123700, 77.987900',
    accuracy: '± 4 m',
    runningA: 308,
    runningB: 200,
    runningTotal: 508,
  },
  {
    id: 5,
    date: '23-07-2026',
    time: '09:28:30 AM',
    grade: 'Grade B',
    entryType: 'Manual',
    count: 22,
    location: '11.123800, 77.988000',
    accuracy: '± 8 m',
    runningA: 308,
    runningB: 222,
    runningTotal: 530,
  },
]

export function TodaysHistoryScreen({ onBack, onExport }: TodaysHistoryScreenProps) {
  const [showExportDialog, setShowExportDialog] = useState(false)

  const todayDate = '24-07-2026'
  const totalA = mockTodaysEntries.reduce((sum, e) => (e.grade === 'A' ? sum + e.count : sum), 0)
  const totalB = mockTodaysEntries.reduce((sum, e) => (e.grade === 'B' ? sum + e.count : sum), 0)

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col" style={{ width: '412px', height: '915px' }}>
      <CoconutCountingHeader todayDate={todayDate} />

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {/* Title */}
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span>🕐</span>
          TODAY&apos;S HISTORY
        </h1>

        {/* GPS Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
          <span className="text-lg flex-shrink-0">📍</span>
          <p className="text-xs text-blue-700">
            GPS is captured automatically in the background for every SEND entry.
          </p>
        </div>

        {/* Summary Tiles */}
        <HistorySummaryTiles
          totalA={totalA}
          totalB={totalB}
          totalAB={totalA + totalB}
          entriesCount={mockTodaysEntries.length}
        />

        {/* Export Button */}
        <button
          onClick={() => setShowExportDialog(true)}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <span>📊</span>
          <span>EXPORT TODAY TO EXCEL</span>
        </button>

        {/* Entry Cards - Scrollable */}
        <div className="space-y-2 flex-1 overflow-y-auto">
          {mockTodaysEntries.map((entry) => (
            <HistoryEntryCard key={entry.id} entry={entry} />
          ))}
        </div>

        {/* Back Button */}
        <button
          onClick={onBack}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>⬅</span>
          <span>BACK TO COUNTING</span>
        </button>
      </div>

      <ExportConfirmationDialog
        isOpen={showExportDialog}
        date={todayDate}
        entryCount={mockTodaysEntries.length}
        onCancel={() => setShowExportDialog(false)}
        onConfirm={() => {
          onExport?.(todayDate)
          setShowExportDialog(false)
        }}
      />
    </div>
  )
}
