'use client'

import { Download, ChevronLeft } from 'lucide-react'
import { MobileHeader } from './mobile-header'
import { TotalCard } from './total-card'

interface HistoryScreenProps {
  onBack: () => void
}

export function HistoryScreen({ onBack }: HistoryScreenProps) {
  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col overflow-hidden" style={{ width: '412px', height: '915px' }}>
      <MobileHeader todayDate="24-07-2026" />

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* Summary Totals */}
        <div className="flex gap-2 mb-3 flex-shrink-0">
          <TotalCard label="TOTAL A" value={675} variant="a" />
          <TotalCard label="TOTAL B" value={845} variant="b" />
          <TotalCard label="TOTAL A+B" value={1520} variant="combined" />
        </div>

        {/* Entry Count */}
        <div className="bg-purple-100 border-2 border-purple-300 rounded-lg px-2 py-2 text-center mb-3 flex-shrink-0">
          <p className="text-xs font-semibold text-purple-800">ENTRIES</p>
          <p className="text-2xl font-bold text-purple-900">10</p>
        </div>

        {/* Export Button */}
        <button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 mb-3 flex-shrink-0">
          <Download className="h-4 w-4" />
          EXPORT EXCEL
        </button>

        {/* History Entries */}
        <div className="space-y-2">
          {[
            { time: '09:15 AM', grade: 'A', type: 'Fixed', count: 200, totals: { a: 200, b: 0, combined: 200 }, gps: '12.9°N, 79.8°E' },
            { time: '09:20 AM', grade: 'B', type: 'Manual', count: 45, totals: { a: 200, b: 45, combined: 245 }, gps: '12.9°N, 79.8°E' },
            { time: '09:30 AM', grade: 'A', type: 'Manual', count: 108, totals: { a: 308, b: 45, combined: 353 }, gps: '12.9°N, 79.8°E' },
            { time: '09:45 AM', grade: 'B', type: 'Fixed', count: 177, totals: { a: 308, b: 222, combined: 530 }, gps: '12.9°N, 79.8°E' },
            { time: '10:00 AM', grade: 'A', type: 'Manual', count: 89, totals: { a: 397, b: 222, combined: 619 }, gps: '12.9°N, 79.8°E' },
            { time: '10:15 AM', grade: 'B', type: 'Manual', count: 134, totals: { a: 397, b: 356, combined: 753 }, gps: '12.9°N, 79.8°E' },
            { time: '10:30 AM', grade: 'A', type: 'Fixed', count: 278, totals: { a: 675, b: 356, combined: 1031 }, gps: '12.9°N, 79.8°E' },
            { time: '10:45 AM', grade: 'B', type: 'Manual', count: 489, totals: { a: 675, b: 845, combined: 1520 }, gps: '12.9°N, 79.8°E' },
          ].map((entry, idx) => (
            <div key={idx} className="bg-white border border-gray-200 rounded-lg p-2 text-xs">
              <div className="flex justify-between mb-1">
                <span className="font-bold text-gray-900">Entry {idx + 1}</span>
                <span className="text-gray-600">{entry.time}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 mb-1 text-xs">
                <div>Grade: <span className="font-semibold">{entry.grade}</span></div>
                <div>Type: <span className="font-semibold">{entry.type}</span></div>
                <div>Count: <span className="font-semibold">{entry.count}</span></div>
                <div>GPS: <span className="font-semibold text-gray-600">{entry.gps}</span></div>
              </div>
              <div className="flex justify-between text-xs font-semibold border-t pt-1">
                <span>A: {entry.totals.a}</span>
                <span>B: {entry.totals.b}</span>
                <span>A+B: {entry.totals.combined}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed Back Button */}
      <button
        onClick={onBack}
        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 mx-2 mb-2 rounded-lg flex items-center justify-center gap-2 flex-shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
        BACK TO COUNTING
      </button>
    </div>
  )
}
