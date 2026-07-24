'use client'

import { useState } from 'react'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { MobileHeader } from './mobile-header'
import { HistorySummaryTiles } from './history-summary-tiles'
import { HistoryEntryCard } from './history-entry-card'
import { ExportConfirmationDialog } from './export-dialog'

interface DateScreenProps {
  onBack: () => void
  showCalendar?: boolean
}

export function DateScreen({ onBack, showCalendar = false }: DateScreenProps) {
  const [selectedDate, setSelectedDate] = useState('22-07-2026')
  const [showDatePicker, setShowDatePicker] = useState(showCalendar)
  const [showExportDialog, setShowExportDialog] = useState(false)

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col" style={{ width: '412px', height: '915px' }}>
      <MobileHeader todayDate="24-07-2026" />

      <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col">
        {/* Title */}
        <h1 className="text-lg font-bold text-gray-900 mb-3">HISTORY BY DATE</h1>

        {/* Date Selector Card */}
        <div className="bg-white border-2 border-blue-200 rounded-lg p-3 mb-3 flex-shrink-0">
          <p className="text-sm font-bold text-gray-900 mb-2">SELECT DATE</p>
          <div className="flex items-center gap-2 mb-3">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />
              PREV
            </button>
            <input
              type="text"
              value={selectedDate}
              readOnly
              className="flex-1 text-center font-bold text-lg border-b-2 border-blue-300 py-1"
            />
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm flex items-center gap-1">
              NEXT
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded text-sm"
          >
            {showDatePicker ? 'HIDE' : 'SHOW'} CALENDAR
          </button>
        </div>

        {/* Calendar View (if open) */}
        {showDatePicker && (
          <div className="bg-white border-2 border-gray-300 rounded-lg p-3 mb-3 flex-shrink-0">
            <p className="text-sm font-bold text-gray-900 mb-2">July 2026</p>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center font-bold text-gray-600 py-1">
                  {day}
                </div>
              ))}
              {Array.from({ length: 25 }, (_, i) => i + 1).map((day) => (
                <button
                  key={day}
                  className={`text-center py-1 rounded font-semibold text-sm ${
                    day === 22
                      ? 'bg-blue-600 text-white'
                      : day === 24
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summary Tiles */}
        <div className="flex-shrink-0 mb-3">
          <HistorySummaryTiles totalA={600} totalB={720} totalAB={1320} entriesCount={8} />
        </div>

        {/* Export Button */}
        <button
          onClick={() => setShowExportDialog(true)}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg mb-3 flex items-center justify-center gap-2 flex-shrink-0"
        >
          <Download className="h-5 w-5" />
          EXPORT SELECTED DATE TO EXCEL
        </button>

        {/* History Entries - Scrollable */}
        <div className="space-y-2 flex-1 overflow-y-auto">
          <HistoryEntryCard
            entryNumber={1}
            time="08:00:00 AM"
            grade="A"
            type="fixed"
            count={200}
            gpsLat="11.234567"
            gpsLng="77.876543"
            gpsAccuracy="± 5 m"
            runningTotalA={200}
            runningTotalB={0}
            runningTotalAB={200}
            synced={true}
          />
          <HistoryEntryCard
            entryNumber={2}
            time="08:25:30 AM"
            grade="B"
            type="manual"
            count={120}
            gpsLat="11.235012"
            gpsLng="77.877890"
            gpsAccuracy="± 6 m"
            runningTotalA={200}
            runningTotalB={120}
            runningTotalAB={320}
            synced={true}
          />
          <HistoryEntryCard
            entryNumber={3}
            time="08:45:15 AM"
            grade="A"
            type="manual"
            count={150}
            gpsLat="11.235456"
            gpsLng="77.878234"
            gpsAccuracy="± 7 m"
            runningTotalA={350}
            runningTotalB={120}
            runningTotalAB={470}
            synced={true}
          />
          <HistoryEntryCard
            entryNumber={4}
            time="09:00:45 AM"
            grade="B"
            type="fixed"
            count={200}
            gpsLat="11.235890"
            gpsLng="77.878678"
            gpsAccuracy="± 5 m"
            runningTotalA={350}
            runningTotalB={320}
            runningTotalAB={670}
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
        date={selectedDate}
        onCancel={() => setShowExportDialog(false)}
        onConfirm={() => setShowExportDialog(false)}
      />
    </div>
  )
}
