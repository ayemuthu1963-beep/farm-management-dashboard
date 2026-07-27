/**
 * Date History Screen
 * Shows history for selected date with calendar picker and entries
 */

'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CoconutCountingHeader } from './coconut-counting-header'
import { HistorySummaryTiles } from './history-summary-tiles'
import { HistoryEntryCard } from './history-entry-card'
import { ExportConfirmationDialog } from './export-confirmation-dialog'
import { mockSelectedDateEntries, mockDateHistoryTotals } from './mock-data'

interface DateHistoryScreenProps {
  onBack?: () => void
  onExport?: (date: string) => void
}

export function DateHistoryScreen({ onBack, onExport }: DateHistoryScreenProps) {
  const [selectedDate, setSelectedDate] = useState('22-07-2026')
  const [showCalendar, setShowCalendar] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col" style={{ width: '412px', height: '915px' }}>
      <CoconutCountingHeader todayDate="24-07-2026" />

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {/* Title */}
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span>⏰</span>
          HISTORY BY DATE
        </h1>

        {/* Date Selector Card */}
        <div className="bg-white border-2 border-green-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">SELECT DATE</p>
          <div className="flex items-center gap-2">
            <button className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded text-sm flex items-center gap-1 transition-colors">
              <ChevronLeft className="h-4 w-4" />
              PREV
            </button>
            <input
              type="text"
              value={selectedDate}
              readOnly
              className="flex-1 text-center font-bold text-lg border-b-2 border-green-300 py-1 bg-transparent"
            />
            <button className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded text-sm flex items-center gap-1 transition-colors">
              NEXT
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded text-sm transition-colors"
          >
            {showCalendar ? '📅 HIDE CALENDAR' : '📅 SHOW CALENDAR'}
          </button>
        </div>

        {/* Calendar Grid (if open) */}
        {showCalendar && (
          <div className="bg-white border-2 border-gray-200 rounded-lg p-3">
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
                  className={`text-center py-1 rounded font-semibold text-xs transition-colors ${
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
        <HistorySummaryTiles
          totalA={mockDateHistoryTotals.totalA}
          totalB={mockDateHistoryTotals.totalB}
          totalAB={mockDateHistoryTotals.totalCombined}
          entriesCount={mockDateHistoryTotals.entries}
        />

        {/* Export Button */}
        <button
          onClick={() => setShowExportDialog(true)}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <span>📊</span>
          <span>EXPORT SELECTED DATE TO EXCEL</span>
        </button>

        {/* Entry Cards - Scrollable */}
        <div className="space-y-2 flex-1 overflow-y-auto">
          {mockSelectedDateEntries.map((entry) => (
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
        date={selectedDate}
        entryCount={mockSelectedDateEntries.length}
        onCancel={() => setShowExportDialog(false)}
        onConfirm={() => {
          onExport?.(selectedDate)
          setShowExportDialog(false)
        }}
      />
    </div>
  )
}
