'use client'

import { useState } from 'react'
import { Send, RotateCcw } from 'lucide-react'

export default function MainCountingScreen({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const [showResetDialog, setShowResetDialog] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="rounded-b-3xl bg-green-700 px-6 py-8 text-center shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-4xl">🌴</div>
          <h1 className="flex-1 text-3xl font-bold text-white md:text-4xl">
            COCONUT COUNTING FORM
          </h1>
          <div className="text-4xl">🥥</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* 2x2 Cards Grid */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          {/* Grade A Fixed - 200 × 1 */}
          <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between rounded-lg bg-green-600 px-4 py-2 text-white">
              <h2 className="font-bold">GRADE A — 200 × 1</h2>
            </div>
            <div className="mb-6 flex items-center justify-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 font-bold text-white text-2xl">
                A1
              </div>
              <div className="text-4xl">🥥</div>
            </div>
            <div className="mb-6 text-center">
              <p className="text-sm font-semibold text-green-700">COUNT</p>
              <p className="text-5xl font-bold text-green-700">200</p>
            </div>
            <button className="w-full rounded-lg bg-green-600 px-6 py-4 font-bold text-white hover:bg-green-700 flex items-center justify-center gap-2 text-lg">
              <Send className="h-5 w-5" /> SEND
            </button>
          </div>

          {/* Grade B Fixed - 400/200 × 1 */}
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-600 px-4 py-2 text-white">
              <h2 className="font-bold">GRADE B — 400/200 × 1</h2>
            </div>
            <div className="mb-6 flex items-center justify-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 font-bold text-white text-2xl">
                B1
              </div>
              <div className="flex gap-1 text-3xl">
                🥥 🥥 🥥
              </div>
            </div>
            <div className="mb-6 text-center">
              <p className="text-sm font-semibold text-blue-700">ENTRY ANY NUMBER UP TO 199</p>
            </div>
            <input
              type="number"
              placeholder="Entry any number up to 199"
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-center focus:border-blue-500 focus:outline-none"
            />
            <button className="w-full rounded-lg bg-blue-600 px-6 py-4 font-bold text-white hover:bg-blue-700 flex items-center justify-center gap-2 text-lg">
              <Send className="h-5 w-5" /> SEND
            </button>
          </div>

          {/* Grade A Manual - UP TO 199 */}
          <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between rounded-lg bg-green-600 px-4 py-2 text-white">
              <h2 className="font-bold">GRADE A — UP TO 199</h2>
            </div>
            <div className="mb-6 flex items-center justify-center">
              <div className="text-5xl text-green-600">📋</div>
            </div>
            <div className="mb-4 text-center">
              <p className="text-sm font-semibold text-green-700">COUNT</p>
              <p className="text-sm text-gray-600">Enter any number up to 199</p>
            </div>
            <input
              type="number"
              placeholder="Entry any number up to 199"
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-center focus:border-green-500 focus:outline-none"
            />
            <button className="w-full rounded-lg bg-green-600 px-6 py-4 font-bold text-white hover:bg-green-700 flex items-center justify-center gap-2 text-lg">
              <Send className="h-5 w-5" /> SEND
            </button>
          </div>

          {/* Grade B Manual - UP TO 199 */}
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-600 px-4 py-2 text-white">
              <h2 className="font-bold">GRADE B — UP TO 199</h2>
            </div>
            <div className="mb-6 flex items-center justify-center">
              <div className="text-5xl text-blue-600">📋</div>
            </div>
            <div className="mb-4 text-center">
              <p className="text-sm font-semibold text-blue-700">COUNT</p>
              <p className="text-sm text-gray-600">Enter any number up to 199</p>
            </div>
            <input
              type="number"
              placeholder="Entry any number up to 199"
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-center focus:border-blue-500 focus:outline-none"
            />
            <button className="w-full rounded-lg bg-blue-600 px-6 py-4 font-bold text-white hover:bg-blue-700 flex items-center justify-center gap-2 text-lg">
              <Send className="h-5 w-5" /> SEND
            </button>
          </div>
        </div>

        {/* Totals Section */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border-2 border-green-200 bg-white p-6 text-center">
            <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-green-700">
              ☑ TOTAL GRADE A
            </p>
            <p className="text-4xl font-bold text-green-700">308</p>
          </div>
          <div className="rounded-lg border-2 border-blue-200 bg-white p-6 text-center">
            <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-blue-700">
              ☑ TOTAL GRADE B
            </p>
            <p className="text-4xl font-bold text-blue-700">222</p>
          </div>
          <div className="rounded-lg border-2 border-teal-400 bg-white p-6 text-center">
            <p className="mb-3 text-sm font-semibold text-gray-700">TOTAL A + B</p>
            <p className="text-4xl font-bold text-teal-600">530</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid gap-4 md:grid-cols-3">
          <button
            onClick={() => onNavigate('history')}
            className="rounded-lg border-2 border-gray-300 bg-white px-6 py-4 font-bold text-gray-700 hover:bg-gray-50 text-lg"
          >
            📜 HISTORY
          </button>
          <button
            onClick={() => onNavigate('dateHistory')}
            className="rounded-lg border-2 border-gray-300 bg-white px-6 py-4 font-bold text-gray-700 hover:bg-gray-50 text-lg"
          >
            📅 DATE
          </button>
          <button
            onClick={() => setShowResetDialog(true)}
            className="rounded-lg border-2 border-red-300 bg-white px-6 py-4 font-bold text-red-600 hover:bg-red-50 text-lg flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-5 w-5" /> RESET
          </button>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
            <h3 className="mb-2 text-center text-xl font-bold text-gray-900">RESET CURRENT COUNT?</h3>
            <p className="mb-6 text-center text-sm text-gray-600">
              This will reset the current active totals to zero. Past history will not be deleted.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowResetDialog(false)}
                className="flex-1 rounded-lg border-2 border-gray-300 px-4 py-3 font-bold text-gray-700 hover:bg-gray-50"
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  setShowResetDialog(false)
                  // Reset logic would go here in Phase 2
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700"
              >
                RESET CURRENT COUNT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
