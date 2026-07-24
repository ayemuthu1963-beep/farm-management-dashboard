'use client'

import { useState } from 'react'
import { History, Calendar, RotateCcw } from 'lucide-react'
import { MobileHeader } from '@/components/coconut-mobile/mobile-header'
import { CountTile } from '@/components/coconut-mobile/count-tile'
import { TotalCard } from '@/components/coconut-mobile/total-card'
import { ActionButton } from '@/components/coconut-mobile/action-button'
import { LiveSessionSummary } from '@/components/coconut-mobile/live-session-summary'
import { ResetConfirmationDialog } from '@/components/coconut-mobile/reset-dialog'
import { HistoryScreen } from '@/components/coconut-mobile/history-screen'
import { DateScreen } from '@/components/coconut-mobile/date-screen'

type Screen = 'main' | 'history' | 'date'

export default function CoconutMobilePage() {
  const [screen, setScreen] = useState<Screen>('main')
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showResetAfter, setShowResetAfter] = useState(false)

  const mainContent = (
    <div className="fixed inset-0 bg-gray-50 flex flex-col" style={{ width: '412px', height: '915px' }}>
      <MobileHeader todayDate="24-07-2026" />

      {/* Main Content - Fixed Height */}
      <div className="flex-1 overflow-hidden flex flex-col px-2 py-2 gap-1.5">
        {/* 2x2 Count Tiles Grid */}
        <div className="grid grid-cols-2 gap-1.5 flex-shrink-0">
          <CountTile grade="A" type="fixed" title="GRADE A — 200" fixedValue={200} badgeIcon="A1" />
          <CountTile grade="B" type="fixed" title="GRADE B — 400/200" fixedValue={400} badgeIcon="B1" />
          <CountTile grade="A" type="manual" title="GRADE A — 1 TO 199" badgeIcon="A2" />
          <CountTile grade="B" type="manual" title="GRADE B — 1 TO 199" badgeIcon="B2" />
        </div>

        {/* Live Session Summary - Centre */}
        <div className="flex-1 min-h-0 flex items-center justify-center px-1">
          <LiveSessionSummary
            totalCoconuts={showResetAfter ? 0 : 530}
            lastEntryGrade={showResetAfter ? null : 'A'}
            lastEntryValue={showResetAfter ? 0 : 200}
            lastEntryTime={showResetAfter ? '' : '10:42:15 AM'}
            entriesCount={showResetAfter ? 0 : 4}
            gpsStatus={true}
            unsyncedCount={0}
          />
        </div>

        {/* Totals Row */}
        <div className="flex gap-1.5 flex-shrink-0">
          <TotalCard label="TOTAL A" value={showResetAfter ? 0 : 308} variant="a" />
          <TotalCard label="TOTAL B" value={showResetAfter ? 0 : 222} variant="b" />
          <TotalCard label="TOTAL A+B" value={showResetAfter ? 0 : 530} variant="combined" />
        </div>

        {/* Action Buttons Row - Bottom */}
        <div className="flex gap-1.5 flex-shrink-0">
          <ActionButton icon={History} label="HISTORY" variant="history" onClick={() => setScreen('history')} />
          <ActionButton icon={Calendar} label="DATE" variant="date" onClick={() => setScreen('date')} />
          <ActionButton icon={RotateCcw} label="RESET" variant="reset" onClick={() => setShowResetDialog(true)} />
        </div>
      </div>

      <ResetConfirmationDialog
        isOpen={showResetDialog}
        onCancel={() => setShowResetDialog(false)}
        onConfirm={() => {
          setShowResetAfter(true)
          setShowResetDialog(false)
        }}
      />
    </div>
  )

  if (screen === 'main') {
    return mainContent
  }

  if (screen === 'history') {
    return <HistoryScreen onBack={() => setScreen('main')} />
  }

  if (screen === 'date' || screen === 'date-calendar') {
    return <DateScreen onBack={() => setScreen('main')} showCalendar={screen === 'date-calendar'} />
  }

  return null
}
