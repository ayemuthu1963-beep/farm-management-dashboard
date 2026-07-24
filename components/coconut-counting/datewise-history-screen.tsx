'use client'

import { useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'

const mockHistoryDataByDate = [
  {
    id: 1,
    date: '22-07-2026',
    time: '10:05:30 AM',
    grade: 'Grade A',
    entryType: 'Fixed 200',
    count: 200,
    location: '11.124000, 77.988200',
    accuracy: '± 5 m',
    runningA: 200,
    runningB: 0,
    runningTotal: 200,
  },
  {
    id: 2,
    date: '22-07-2026',
    time: '10:09:15 AM',
    grade: 'Grade B',
    entryType: 'Fixed 200',
    count: 200,
    location: '11.124100, 77.988300',
    accuracy: '± 6 m',
    runningA: 200,
    runningB: 200,
    runningTotal: 400,
  },
  {
    id: 3,
    date: '22-07-2026',
    time: '10:12:45 AM',
    grade: 'Grade A',
    entryType: 'Manual',
    count: 50,
    location: '11.124200, 77.988400',
    accuracy: '± 4 m',
    runningA: 250,
    runningB: 200,
    runningTotal: 450,
  },
  {
    id: 4,
    date: '22-07-2026',
    time: '10:15:20 AM',
    grade: 'Grade B',
    entryType: 'Manual',
    count: 35,
    location: '11.124300, 77.988500',
    accuracy: '± 7 m',
    runningA: 250,
    runningB: 235,
    runningTotal: 485,
  },
]

export default function DatewiseHistoryScreen({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const [selectedDate, setSelectedDate] = useState('22-07-2026')

  const handlePrevDay = () => {
    // Mock: decrement date by 1 day
    setSelectedDate('21-07-2026')
  }

  const handleNextDay = () => {
    // Mock: increment date by 1 day
    setSelectedDate('23-07-2026')
  }

  // Mock totals for selected date
  const totalA = 250
  const totalB = 235
  const totalAB = 485
  const totalEntries = 4

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="rounded-b-3xl bg-blue-600 px-6 py-8 shadow-lg">
        <h1 className="text-center text-3xl font-bold text-white md:text-4xl">
          COUNT HISTORY BY DATE
        </h1>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Date Selector */}
        <div className="mb-8 rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
          <p className="mb-4 text-center text-sm font-semibold text-blue-700">SELECT DATE</p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handlePrevDay}
              className="rounded-lg bg-blue-600 p-3 text-white hover:bg-blue-700"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="rounded-lg border-2 border-blue-400 bg-white px-8 py-3">
              <p className="text-center text-2xl font-bold text-blue-600">{selectedDate}</p>
            </div>
            <button
              onClick={handleNextDay}
              className="rounded-lg bg-blue-600 p-3 text-white hover:bg-blue-700"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border-2 border-green-200 bg-white p-4 text-center">
            <p className="text-xs font-semibold text-green-700">TOTAL GRADE A</p>
            <p className="mt-2 text-3xl font-bold text-green-700">{totalA}</p>
          </div>
          <div className="rounded-lg border-2 border-blue-200 bg-white p-4 text-center">
            <p className="text-xs font-semibold text-blue-700">TOTAL GRADE B</p>
            <p className="mt-2 text-3xl font-bold text-blue-700">{totalB}</p>
          </div>
          <div className="rounded-lg border-2 border-teal-400 bg-white p-4 text-center">
            <p className="text-xs font-semibold text-gray-700">TOTAL A + B</p>
            <p className="mt-2 text-3xl font-bold text-teal-600">{totalAB}</p>
          </div>
          <div className="rounded-lg border-2 border-gray-300 bg-white p-4 text-center">
            <p className="text-xs font-semibold text-gray-700">TOTAL ENTRIES</p>
            <p className="mt-2 text-3xl font-bold text-gray-700">{totalEntries}</p>
          </div>
        </div>

        {/* Export Button */}
        <button className="mb-8 w-full rounded-lg bg-blue-600 px-6 py-4 font-bold text-white hover:bg-blue-700 text-lg">
          📊 EXPORT SELECTED DATE TO EXCEL
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
              {mockHistoryDataByDate.map((row) => (
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
          {mockHistoryDataByDate.map((row) => (
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

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handlePrevDay}
            className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-6 py-3 font-bold text-gray-700 hover:bg-gray-50"
          >
            ← PREVIOUS DAY
          </button>
          <button
            onClick={handleNextDay}
            className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-6 py-3 font-bold text-gray-700 hover:bg-gray-50"
          >
            NEXT DAY →
          </button>
        </div>

        {/* Back Button */}
        <button
          onClick={() => onNavigate('main')}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-6 py-4 font-bold text-gray-700 hover:bg-gray-50 text-lg"
        >
          <ArrowLeft className="h-5 w-5" /> BACK TO COUNTING
        </button>
      </div>
    </div>
  )
}
