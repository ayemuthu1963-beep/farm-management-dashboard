'use client'

import { CoconutHeader } from './coconut-header'
import { TotalSummaryTile } from './total-summary-tile'
import { Download, MapPin } from 'lucide-react'

interface HistoryEntry {
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

interface TodaysHistoryScreenProps {
  onBack: () => void
}

const mockHistoryData: HistoryEntry[] = [
  {
    id: 1,
    time: '09:15:22 AM',
    grade: 'A',
    type: 'Fixed 200',
    count: 200,
    gps: '11.123456, 77.987654',
    accuracy: '± 6 m',
    totalA: 200,
    totalB: 0,
    totalAB: 200,
  },
  {
    id: 2,
    time: '09:18:41 AM',
    grade: 'A',
    type: 'Manual',
    count: 75,
    gps: '11.123500, 77.987700',
    accuracy: '± 5 m',
    totalA: 275,
    totalB: 0,
    totalAB: 275,
  },
  {
    id: 3,
    time: '09:22:10 AM',
    grade: 'B',
    type: 'Fixed 200',
    count: 200,
    gps: '11.123600, 77.987800',
    accuracy: '± 7 m',
    totalA: 275,
    totalB: 200,
    totalAB: 475,
  },
  {
    id: 4,
    time: '09:35:55 AM',
    grade: 'A',
    type: 'Manual',
    count: 100,
    gps: '11.123700, 77.987900',
    accuracy: '± 5 m',
    totalA: 375,
    totalB: 200,
    totalAB: 575,
  },
  {
    id: 5,
    time: '09:42:30 AM',
    grade: 'B',
    type: 'Manual',
    count: 95,
    gps: '11.123800, 77.988000',
    accuracy: '± 6 m',
    totalA: 375,
    totalB: 295,
    totalAB: 670,
  },
  {
    id: 6,
    time: '10:05:12 AM',
    grade: 'A',
    type: 'Fixed 200',
    count: 200,
    gps: '11.124000, 77.988200',
    accuracy: '± 4 m',
    totalA: 575,
    totalB: 295,
    totalAB: 870,
  },
  {
    id: 7,
    time: '10:15:48 AM',
    grade: 'B',
    type: 'Fixed 200',
    count: 200,
    gps: '11.124100, 77.988300',
    accuracy: '± 6 m',
    totalA: 575,
    totalB: 495,
    totalAB: 1070,
  },
  {
    id: 8,
    time: '10:22:33 AM',
    grade: 'A',
    type: 'Manual',
    count: 100,
    gps: '11.124200, 77.988400',
    accuracy: '± 5 m',
    totalA: 675,
    totalB: 495,
    totalAB: 1170,
  },
  {
    id: 9,
    time: '10:30:15 AM',
    grade: 'B',
    type: 'Manual',
    count: 150,
    gps: '11.124300, 77.988500',
    accuracy: '± 7 m',
    totalA: 675,
    totalB: 645,
    totalAB: 1320,
  },
  {
    id: 10,
    time: '10:45:22 AM',
    grade: 'B',
    type: 'Manual',
    count: 200,
    gps: '11.124400, 77.988600',
    accuracy: '± 6 m',
    totalA: 675,
    totalB: 845,
    totalAB: 1520,
  },
]

export function TodaysHistoryScreen({ onBack }: TodaysHistoryScreenProps) {
  const totalA = 675
  const totalB = 845
  const totalAB = 1520
  const entries = mockHistoryData.length

  return (
    <div className="min-h-screen bg-gray-50">
      <CoconutHeader
        title="TODAY'S COUNT HISTORY"
        showBackButton
        onBack={onBack}
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="space-y-6">
          {/* Date and GPS Note */}
          <div className="space-y-3">
            <div className="text-base sm:text-lg font-semibold text-gray-900">
              Date: <span className="font-bold text-lg sm:text-xl">23-07-2026</span>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-4 border-2 border-blue-200">
              <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-900">
                GPS is captured automatically in the background for every SEND entry.
              </p>
            </div>
          </div>

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
            EXPORT TODAY TO EXCEL
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
                {mockHistoryData.map((entry, index) => (
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
            {mockHistoryData.map((entry) => (
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
