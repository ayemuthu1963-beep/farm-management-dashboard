'use client'

import { Download, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { MobileHeader } from './mobile-header'
import { HistorySummaryTiles } from './history-summary-tiles'
import { HistoryEntryCard } from './history-entry-card'
import { ExportConfirmationDialog } from './export-dialog'

interface HistoryScreenProps {
  onBack: () => void
}

export function HistoryScreen({ onBack }: HistoryScreenProps) {
  const [showExportDialog, setShowExportDialog] = useState(false)

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col" style={{ width: '412px', height: '915px' }}>
      <MobileHeader todayDate="24-07-2026" />

      <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col">
        {/* Title */}
        <h1 className="text-lg font-bold text-gray-900 mb-3">TODAY'S COUNT HISTORY</h1>

        {/* GPS Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3 flex items-start gap-2 flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">GPS is captured automatically in the background for every SEND entry.</p>
        </div>

        {/* Summary Tiles */}
        <div className="flex-shrink-0 mb-3">
          <HistorySummaryTiles totalA={675} totalB={845} totalAB={1520} entriesCount={10} />
        </div>

        {/* Export Button */}
        <button
          onClick={() => setShowExportDialog(true)}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg mb-3 flex items-center justify-center gap-2 flex-shrink-0"
        >
          <Download className="h-5 w-5" />
          EXPORT TODAY TO EXCEL
        </button>

        {/* Entry Cards - Scrollable */}
        <div className="space-y-2 flex-1 overflow-y-auto">
          <HistoryEntryCard
            entryNumber={1}
            time="09:15:22 AM"
            grade="A"
            type="fixed"
            count={200}
            gpsLat="11.123456"
            gpsLng="77.987654"
            gpsAccuracy="± 6 m"
            runningTotalA={200}
            runningTotalB={0}
            runningTotalAB={200}
            synced={true}
          />
          <HistoryEntryCard
            entryNumber={2}
            time="09:32:45 AM"
            grade="B"
            type="fixed"
            count={200}
            gpsLat="11.123789"
            gpsLng="77.988102"
            gpsAccuracy="± 5 m"
            runningTotalA={200}
            runningTotalB={200}
            runningTotalAB={400}
            synced={true}
          />
          <HistoryEntryCard
            entryNumber={3}
            time="10:15:10 AM"
            grade="A"
            type="manual"
            count={75}
            gpsLat="11.124012"
            gpsLng="77.988567"
            gpsAccuracy="± 7 m"
            runningTotalA={275}
            runningTotalB={200}
            runningTotalAB={475}
            synced={true}
          />
          <HistoryEntryCard
            entryNumber={4}
            time="10:42:15 AM"
            grade="A"
            type="fixed"
            count={200}
            gpsLat="11.124345"
            gpsLng="77.989234"
            gpsAccuracy="± 6 m"
            runningTotalA={475}
            runningTotalB={200}
            runningTotalAB={675}
            synced={false}
          />
        </div>

        {/* Back Button */}
        <button
          onClick={onBack}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg mt-3 flex-shrink-0"
        >
          BACK TO COUNTING
        </button>
      </div>

      <ExportConfirmationDialog
        isOpen={showExportDialog}
        date="24-07-2026"
        onCancel={() => setShowExportDialog(false)}
        onConfirm={() => setShowExportDialog(false)}
      />
    </div>
  )
}
