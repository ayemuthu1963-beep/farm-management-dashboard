'use client'

import { useState } from 'react'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { MobileHeader } from './mobile-header'
import { TotalCard } from './total-card'

interface DateScreenProps {
  onBack: () => void
  showCalendar?: boolean
}

export function DateScreen({ onBack, showCalendar = false }: DateScreenProps) {
  const [selectedDate, setSelectedDate] = useState('22-07-2026')
  const [showDatePicker, setShowDatePicker] = useState(showCalendar)

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col overflow-hidden" style={{ width: '412px', height: '915px' }}>
      <MobileHeader todayDate="24-07-2026" />

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* Date Selector Card */}
        <div className="bg-white border-2 border-blue-200 rounded-lg p-3 mb-3">
          <p className="text-sm font-bold text-gray-900 mb-2">SELECT DATE</p>
          <div className="flex items-center gap-2 mb-3">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />
              PREV
            </button>
            <input
              type="text"
              value={selectedDate}
              readOnly
              className="flex-1 text-center font-bold text-lg border-b-2 border-blue-300 py-1"
            />
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm flex items-center gap-1">
              NEXT
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-sm"
          >
            {showDatePicker ? 'HIDE' : 'SHOW'} CALENDAR
          </button>
        </div>

        {/* Calendar View (if open) */}
        {showDatePicker && (
          <div className="bg-white border-2 border-gray-300 rounded-lg p-3 mb-3">
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
                      ? 'bg-green-200 text-green-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summary Totals */}
        <div className="flex gap-2 mb-3 flex-shrink-0">
          <TotalCard label="TOTAL A" value={600} variant="a" />
          <TotalCard label="TOTAL B" value={720} variant="b" />
          <TotalCard label="TOTAL A+B" value={1320} variant="combined" />
        </div>

        {/* Entry Count */}
        <div className="bg-purple-100 border-2 border-purple-300 rounded-lg px-2 py-2 text-center mb-3 flex-shrink-0">
          <p className="text-xs font-semibold text-purple-800">ENTRIES</p>
          <p className="text-2xl font-bold text-purple-900">8</p>
        </div>

        {/* Export Button */}
        <button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 mb-3 flex-shrink-0">
          <Download className="h-4 w-4" />
          EXPORT EXCEL
        </button>

        {/* History Entries for Selected Date */}
        <div className="space-y-2">
          {[
            { time: '08:00 AM', grade: 'A', type: 'Fixed', count: 200, totals: { a: 200, b: 0, combined: 200 }, gps: '12.9°N, 79.8°E' },
            { time: '08:20 AM', grade: 'B', type: 'Manual', count: 120, totals: { a: 200, b: 120, combined: 320 }, gps: '12.9°N, 79.8°E' },
            { time: '08:40 AM', grade: 'A', type: 'Manual', count: 150, totals: { a: 350, b: 120, combined: 470 }, gps: '12.9°N, 79.8°E' },
            { time: '09:00 AM', grade: 'B', type: 'Fixed', count: 200, totals: { a: 350, b: 320, combined: 670 }, gps: '12.9°N, 79.8°E' },
            { time: '09:20 AM', grade: 'A', type: 'Manual', count: 250, totals: { a: 600, b: 320, combined: 920 }, gps: '12.9°N, 79.8°E' },
            { time: '09:40 AM', grade: 'B', type: 'Manual', count: 400, totals: { a: 600, b: 720, combined: 1320 }, gps: '12.9°N, 79.8°E' },
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
