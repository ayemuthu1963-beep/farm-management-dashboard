'use client'

import { ArrowLeft } from 'lucide-react'

const mockHistoryData = [
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

export default function TodaysHistoryScreen({ onNavigate }: { onNavigate: (screen: string) => void }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="rounded-b-3xl bg-green-700 px-6 py-8 shadow-lg">
        <h1 className="text-center text-3xl font-bold text-white md:text-4xl">
          TODAY'S COUNT HISTORY
        </h1>
        <p className="mt-2 text-center text-lg text-green-100">23 July 2026</p>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Summary Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border-2 border-green-200 bg-white p-4 text-center">
            <p className="text-xs font-semibold text-green-700">TOTAL GRADE A</p>
            <p className="mt-2 text-3xl font-bold text-green-700">308</p>
          </div>
          <div className="rounded-lg border-2 border-blue-200 bg-white p-4 text-center">
            <p className="text-xs font-semibold text-blue-700">TOTAL GRADE B</p>
            <p className="mt-2 text-3xl font-bold text-blue-700">222</p>
          </div>
          <div className="rounded-lg border-2 border-teal-400 bg-white p-4 text-center">
            <p className="text-xs font-semibold text-gray-700">TOTAL A + B</p>
            <p className="mt-2 text-3xl font-bold text-teal-600">530</p>
          </div>
          <div className="rounded-lg border-2 border-gray-300 bg-white p-4 text-center">
            <p className="text-xs font-semibold text-gray-700">TOTAL ENTRIES</p>
            <p className="mt-2 text-3xl font-bold text-gray-700">5</p>
          </div>
        </div>

        {/* Export Button */}
        <button className="mb-8 w-full rounded-lg bg-green-600 px-6 py-4 font-bold text-white hover:bg-green-700 text-lg">
          📊 EXPORT TODAY TO EXCEL
        </button>

        {/* Desktop Table */}
        <div className="mb-8 hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr className="text-left text-sm font-semibold text-gray-700">
                <th className="border-b px-4 py-3">Entry #</th>
                <th className="border-b px-4 py-3">Date</th>
                <th className="border-b px-4 py-3">Time</th>
                <th className="border-b px-4 py-3">Grade</th>
                <th className="border-b px-4 py-3">Entry Type</th>
                <th className="border-b px-4 py-3">Count</th>
                <th className="border-b px-4 py-3">GPS Location</th>
                <th className="border-b px-4 py-3">Accuracy</th>
                <th className="border-b px-4 py-3">Running A</th>
                <th className="border-b px-4 py-3">Running B</th>
                <th className="border-b px-4 py-3">Running Total</th>
              </tr>
            </thead>
            <tbody>
              {mockHistoryData.map((row) => (
                <tr key={row.id} className="border-b text-sm text-gray-700 hover:bg-gray-50">
                  <td className="px-4 py-3">{row.id}</td>
                  <td className="px-4 py-3">{row.date}</td>
                  <td className="px-4 py-3">{row.time}</td>
                  <td className="px-4 py-3 font-semibold">{row.grade}</td>
                  <td className="px-4 py-3">{row.entryType}</td>
                  <td className="px-4 py-3 font-bold">{row.count}</td>
                  <td className="px-4 py-3 text-xs">{row.location}</td>
                  <td className="px-4 py-3 text-xs">{row.accuracy}</td>
                  <td className="px-4 py-3 font-bold text-green-600">{row.runningA}</td>
                  <td className="px-4 py-3 font-bold text-blue-600">{row.runningB}</td>
                  <td className="px-4 py-3 font-bold text-teal-600">{row.runningTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="mb-8 space-y-4 md:hidden">
          {mockHistoryData.map((row) => (
            <div key={row.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between border-b pb-3">
                <span className="text-xs font-semibold text-gray-500">Entry #{row.id}</span>
                <span className="text-xs font-semibold text-gray-500">{row.time}</span>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Grade</p>
                  <p className="font-semibold text-gray-700">{row.grade}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Entry Type</p>
                  <p className="font-semibold text-gray-700">{row.entryType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Count</p>
                  <p className="font-bold text-gray-900">{row.count}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">GPS Accuracy</p>
                  <p className="font-semibold text-gray-700">{row.accuracy}</p>
                </div>
              </div>
              <div className="border-t pt-3 text-xs">
                <p className="mb-1 text-gray-500">GPS: {row.location}</p>
                <div className="flex gap-4">
                  <div className="font-semibold text-green-600">A: {row.runningA}</div>
                  <div className="font-semibold text-blue-600">B: {row.runningB}</div>
                  <div className="font-semibold text-teal-600">Total: {row.runningTotal}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* GPS Info Note */}
        <div className="mb-8 rounded-lg bg-blue-50 p-4 text-center text-sm text-blue-700">
          🛰 GPS captured automatically in background
        </div>

        {/* Back Button */}
        <button
          onClick={() => onNavigate('main')}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-6 py-4 font-bold text-gray-700 hover:bg-gray-50 text-lg"
        >
          <ArrowLeft className="h-5 w-5" /> BACK TO COUNTING
        </button>
      </div>
    </div>
  )
}
