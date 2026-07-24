/**
 * Main Counting Screen
 * Mobile-only Android portrait (412×915 px)
 * Shows count tiles, live session summary, action buttons
 */

'use client'

import { useState } from 'react'
import { CoconutCountingHeader } from './coconut-counting-header'
import { CountTile } from './count-tile'
import { CompactTotalTile } from './compact-total-tile'
import { LiveSessionSummary } from './live-session-summary'
import { ActionButton } from './action-button'
import { ResetConfirmationDialog } from './reset-confirmation-dialog'
import { mockLiveSessionState } from './mock-data'

interface MainCountingScreenProps {
  onHistoryClick?: () => void
  onDateClick?: () => void
  onResetClick?: () => void
}

export function MainCountingScreen({
  onHistoryClick,
  onDateClick,
  onResetClick,
}: MainCountingScreenProps) {
  const [showResetDialog, setShowResetDialog] = useState(false)

  const handleResetConfirm = () => {
    setShowResetDialog(false)
    onResetClick?.()
  }

  const { totals, lastEntry } = mockLiveSessionState

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col" style={{ width: '412px', height: '915px' }}>
      {/* Header */}
      <CoconutCountingHeader todayDate="24-07-2026" />

      {/* Main Content - No scroll, fit exactly on screen */}
      <div className="flex-1 px-3 py-2 flex flex-col gap-1.5 overflow-hidden">
        {/* 2×2 Count Tiles Grid */}
        <div className="grid grid-cols-2 gap-1.5">
          <CountTile
            grade="A"
            type="fixed"
            title="GRADE A — 200"
            badgeLabel="A1"
            value={200}
            onSend={() => {}}
          />
          <CountTile
            grade="B"
            type="fixed"
            title="GRADE B — 400/200"
            badgeLabel="B1"
            value={400}
            onSend={() => {}}
          />
          <CountTile
            grade="A"
            type="manual"
            title="GRADE A — 1 TO 199"
            badgeLabel="A2"
            value={0}
            onSend={() => {}}
          />
          <CountTile
            grade="B"
            type="manual"
            title="GRADE B — 1 TO 199"
            badgeLabel="B2"
            value={0}
            onSend={() => {}}
          />
        </div>

        {/* Compact Totals Row */}
        <div className="flex gap-1.5">
          <CompactTotalTile label="TOTAL A" value={totals.totalA} variant="a" />
          <CompactTotalTile label="TOTAL B" value={totals.totalB} variant="b" />
          <CompactTotalTile label="TOTAL A+B" value={totals.totalCombined} variant="combined" />
        </div>

        {/* Live Session Summary - Centre */}
        <div className="flex-1 min-h-0 flex items-center justify-center px-1">
          <LiveSessionSummary
            totalCoconuts={totals.totalCombined}
            lastEntryGrade={lastEntry?.grade}
            lastEntryValue={lastEntry?.count}
            lastEntryTime={lastEntry?.time}
            entriesCount={totals.entries}
            gpsActive={totals.gpsActive}
            unsynced={totals.unsynced}
          />
        </div>

        {/* Action Buttons Row - Bottom */}
        <div className="flex gap-1.5">
          <ActionButton
            icon="🕐"
            label="HISTORY"
            variant="history"
            onClick={onHistoryClick}
          />
          <ActionButton
            icon="📅"
            label="DATE"
            variant="date"
            onClick={onDateClick}
          />
          <ActionButton
            icon="⟳"
            label="RESET"
            variant="reset"
            onClick={() => setShowResetDialog(true)}
          />
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <ResetConfirmationDialog
        isOpen={showResetDialog}
        onCancel={() => setShowResetDialog(false)}
        onConfirm={handleResetConfirm}
      />
    </div>
  )
}
