'use client'

import { useState } from 'react'
import { History, Calendar, RotateCcw } from 'lucide-react'
import { MobileHeader } from '@/components/coconut-mobile/mobile-header'
import { CountTile } from '@/components/coconut-mobile/count-tile'
import { TotalCard } from '@/components/coconut-mobile/total-card'
import { ActionButton } from '@/components/coconut-mobile/action-button'
import { HistoryScreen } from '@/components/coconut-mobile/history-screen'
import { DateScreen } from '@/components/coconut-mobile/date-screen'

type Screen = 'main' | 'history' | 'date' | 'date-calendar'

export default function CoconutMobilePage() {
  const [screen, setScreen] = useState<Screen>('main')
  const [showResetDialog, setShowResetDialog] = useState(false)

  if (screen === 'main') {
    return (
      <div className="fixed inset-0 bg-gray-50 flex flex-col" style={{ width: '412px', height: '915px', maxWidth: '100vw' }}>
        {/* Fixed viewport size for Android */}
        <MobileHeader todayDate="24-07-2026" />

        {/* Main Content - Fixed Height to Prevent Scroll */}
        <div className="flex-1 overflow-hidden flex flex-col px-2 py-2 gap-2">
          {/* 2x2 Count Tiles Grid */}
          <div className="grid grid-cols-2 gap-2 flex-shrink-0">
            <CountTile
              grade="A"
              type="fixed"
              title="GRADE A — 200"
              fixedValue={200}
              badgeIcon="A1"
            />
            <CountTile
              grade="B"
              type="fixed"
              title="GRADE B — 400/200"
              fixedValue={400}
              badgeIcon="B1"
            />
            <CountTile
              grade="A"
              type="manual"
              title="GRADE A — 1 TO 199"
              badgeIcon="A2"
            />
            <CountTile
              grade="B"
              type="manual"
              title="GRADE B — 1 TO 199"
              badgeIcon="B2"
            />
          </div>

          {/* Totals Row */}
          <div className="flex gap-2 flex-shrink-0">
            <TotalCard label="TOTAL A" value={308} variant="a" />
            <TotalCard label="TOTAL B" value={222} variant="b" />
            <TotalCard label="TOTAL A+B" value={530} variant="combined" />
          </div>

          {/* Action Buttons Row - Bottom */}
          <div className="flex gap-2 flex-shrink-0 mt-auto">
            <ActionButton
              icon={History}
              label="HISTORY"
              variant="history"
              onClick={() => setScreen('history')}
            />
            <ActionButton
              icon={Calendar}
              label="DATE"
              variant="date"
              onClick={() => setScreen('date')}
            />
            <ActionButton
              icon={RotateCcw}
              label="RESET"
              variant="reset"
              onClick={() => setShowResetDialog(true)}
            />
          </div>
        </div>

        {/* Reset Confirmation Dialog */}
        {showResetDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-4 max-w-xs mx-2">
              <h2 className="text-lg font-bold text-gray-900 mb-3">RESET CURRENT COUNT?</h2>
              <p className="text-sm text-gray-700 mb-4">
                Current A, B and A+B totals will return to zero.
              </p>
              <p className="text-sm text-gray-700 mb-4">History will remain saved.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResetDialog(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold py-2 px-3 rounded-lg transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => setShowResetDialog(false)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-lg transition-colors"
                >
                  RESET
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (screen === 'history') {
    return <HistoryScreen onBack={() => setScreen('main')} />
  }

  if (screen === 'date' || screen === 'date-calendar') {
    return <DateScreen onBack={() => setScreen('main')} showCalendar={screen === 'date-calendar'} />
  }

  return null
}
