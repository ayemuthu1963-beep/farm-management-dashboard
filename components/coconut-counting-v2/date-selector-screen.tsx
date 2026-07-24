'use client'

import { useState } from 'react'
import { CoconutHeader } from './coconut-header'
import { TotalSummaryTile } from './total-summary-tile'
import { Download, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface DateHistoryEntry {
  id: number
  time: string
  grade: 'A' | 'B'
  type: string
  count: number
  gps: string
  accuracy: string
  totalA: number
  totalB: number
  totalAB: number
}

interface DateSelectorScreenProps {
  onBack: () => void
}

const mockDateHistoryData: DateHistoryEntry[] = [
  {
    id: 1,
    time: '08:45:10 AM',
    grade: 'A',
    type: 'Fixed 200',
    count: 200,
    gps: '11.125000, 77.990000',
    accuracy: '± 5 m',
    totalA: 200,
    totalB: 0,
    totalAB: 200,
  },
  {
    id: 2,
    time: '09:10:30 AM',
    grade: 'B',
    type: 'Manual',
    count: 150,
    gps: '11.125100, 77.990100',
    accuracy: '± 6 m',
    totalA: 200,
    totalB: 150,
    totalAB: 350,
  },
  {
    id: 3,
    time: '09:35:45 AM',
    grade: 'A',
    type: 'Manual',
    count: 125,
    gps: '11.125200, 77.990200',
    accuracy: '± 5 m',
    totalA: 325,
    totalB: 150,
    totalAB: 475,
  },
  {
    id: 4,
    time: '10:15:20 AM',
    grade: 'B',
    type: 'Fixed 200',
    count: 200,
    gps: '11.125300, 77.990300',
    accuracy: '± 7 m',
    totalA: 325,
    totalB: 350,
    totalAB: 675,
  },
  {
    id: 5,
    time: '11:00:15 AM',
    grade: 'A',
    type: 'Fixed 200',
    count: 200,
    gps: '11.125400, 77.990400',
    accuracy: '± 4 m',
    totalA: 525,
    totalB: 350,
    totalAB: 875,
  },
  {
    id: 6,
    time: '11:45:30 AM',
    grade: 'B',
    type: 'Manual',
    count: 170,
    gps: '11.125500, 77.990500',
    accuracy: '± 6 m',
    totalA: 525,
    totalB: 520,
    totalAB: 1045,
  },
  {
    id: 7,
    time: '12:30:00 PM',
    grade: 'A',
    type: 'Manual',
    count: 75,
    gps: '11.125600, 77.990600',
    accuracy: '± 5 m',
    totalA: 600,
    totalB: 520,
    totalAB: 1120,
  },
  {
    id: 8,
    time: '01:15:40 PM',
    grade: 'B',
    type: 'Fixed 200',
    count: 200,
    gps: '11.125700, 77.990700',
    accuracy: '± 6 m',
    totalA: 600,
    totalB: 720,
    totalAB: 1320,
  },
]

export function DateSelectorScreen({ onBack }: DateSelectorScreenProps) {
  const [selectedDate, setSelectedDate] = useState('22-07-2026')
  const [showCalendar, setShowCalendar] = useState(false)

  const totalA = 600
  const totalB = 720
  const totalAB = 1320
  const entries = mockDateHistoryData.length

  const handlePreviousDay = () => {
    // Mock: decrement date
    const date = new Date('2026-07-22')
    date.setDate(date.getDate() - 1)
    setSelectedDate(date.toLocaleDateString('en-GB').replace(/\//g, '-'))
  }

  const handleNextDay = () => {
    // Mock: increment date
    const date = new Date('2026-07-22')
    date.setDate(date.getDate() + 1)
    setSelectedDate(date.toLocaleDateString('en-GB').replace(/\//g, '-'))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CoconutHeader
        title="COUNT HISTORY BY DATE"
        showBackButton
        onBack={onBack}
        todayDate="24-07-2026"
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="space-y-6">
          {/* Date Selector Card */}
          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 sm:p-8">
            <div className="space-y-4">
              <div className="text-lg font-bold text-blue-900 uppercase tracking-wide">
                SELECT DATE
              </div>

              {/* Date Input Group */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handlePreviousDay}
                  className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-bold text-white transition-colors hover:bg-blue-700"
                >
                  <ChevronLeft className="h-5 w-5" />
                  Previous Day
                </button>

                <div className="flex-1 flex items-center gap-3">
                  <Calendar className="h-6 w-6 text-blue-600 flex-shrink-0" />
                  <input
                    type="text"
                    value={selectedDate}
                    readOnly
                    className="flex-1 rounded-lg border-2 border-blue-300 bg-white px-4 py-3 text-center text-2xl font-bold text-blue-900"
                  />
                </div>

                <button
                  onClick={handleNextDay}
                  className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-bold text-white transition-colors hover:bg-blue-700"
                >
                  Next Day
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setSelectedDate('23-07-2026')}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white transition-colors hover:bg-blue-700 text-sm"
                >
                  TODAY
                </button>
                <button
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="flex-1 rounded-lg border-2 border-blue-600 px-4 py-2 font-bold text-blue-900 transition-colors hover:bg-blue-100 text-sm"
                >
                  {showCalendar ? 'HIDE CALENDAR' : 'OPEN CALENDAR'}
                </button>
              </div>
            </div>
          </div>

          {/* Mock Calendar Display */}
          {showCalendar && (
            <div className="rounded-2xl border-2 border-gray-300 bg-white p-6">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900 mb-4">July 2026</div>
                <div className="grid grid-cols-7 gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="h-8 font-bold text-gray-600 text-sm flex items-center justify-center">
                      {day}
                    </div>
                  ))}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-10" />
                  ))}
                  {Array.from({ length: 27 }).map((_, i) => {
                    const day = i + 1
                    const dateStr = `${String(day).padStart(2, '0')}-07-2026`
                    const isSelected = dateStr === selectedDate
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`h-10 rounded text-sm font-semibold transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-100 text-gray-900'
                        }`}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Summary Tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <TotalSummaryTile type="grade-a" value={totalA} />
            <TotalSummaryTile type="grade-b" value={totalB} />
            <TotalSummaryTile type="combined" value={totalAB} />
            <div className="rounded-2xl border-2 border-gray-300 bg-gray-100 overflow-hidden shadow-sm">
              <div className="bg-gray-600 px-4 py-2 sm:px-6 sm:py-3">
                <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide">
                  Total Entries
                </span>
              </div>
              <div className="px-4 py-6 sm:px-6 sm:py-8 text-center">
                <div className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-700">
                  {entries}
                </div>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <button className="w-full sm:w-auto rounded-lg bg-green-600 px-6 py-3 sm:py-4 font-bold text-white transition-colors hover:bg-green-700 flex items-center justify-center gap-2 text-base sm:text-lg">
            <Download className="h-5 w-5 sm:h-6 sm:w-6" />
            EXPORT SELECTED DATE TO EXCEL
          </button>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border-2 border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Entry #</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Time</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Grade</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Type</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Count</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">GPS Location</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Accuracy</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-green-700">Total A</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-blue-700">Total B</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-teal-700">Total A+B</th>
                </tr>
              </thead>
              <tbody>
                {mockDateHistoryData.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-gray-200 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-gray-100 transition-colors`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">#{entry.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{entry.time}</td>
                    <td className="px-4 py-3 text-sm font-bold">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-white font-bold ${
                          entry.grade === 'A'
                            ? 'bg-green-600'
                            : 'bg-blue-600'
                        }`}
                      >
                        {entry.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{entry.type}</td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">
                      {entry.count}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{entry.gps}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{entry.accuracy}</td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-green-700">
                      {entry.totalA}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-blue-700">
                      {entry.totalB}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-teal-700">
                      {entry.totalAB}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {mockDateHistoryData.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-lg border-2 p-4 ${
                  entry.grade === 'A'
                    ? 'border-green-200 bg-green-50'
                    : 'border-blue-200 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="font-bold text-lg">Entry #{entry.id}</div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-white font-bold text-sm ${
                      entry.grade === 'A'
                        ? 'bg-green-600'
                        : 'bg-blue-600'
                    }`}
                  >
                    {entry.grade}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time:</span>
                    <span className="font-semibold">{entry.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-semibold">{entry.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Count:</span>
                    <span className="font-bold text-lg">{entry.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">GPS:</span>
                    <span className="font-mono text-xs">{entry.gps}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Accuracy:</span>
                    <span className="font-semibold">{entry.accuracy}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-green-700 font-bold">Total A: {entry.totalA}</span>
                    <span className="text-blue-700 font-bold">Total B: {entry.totalB}</span>
                    <span className="text-teal-700 font-bold">A+B: {entry.totalAB}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Back Button */}
          <button
            onClick={onBack}
            className="w-full rounded-lg bg-gray-600 py-3 font-bold text-white transition-colors hover:bg-gray-700"
          >
            BACK TO COUNTING
          </button>
        </div>
      </main>
    </div>
  )
}
