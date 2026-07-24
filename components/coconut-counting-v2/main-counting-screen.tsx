'use client'

import { useState } from 'react'
import { CoconutHeader } from './coconut-header'
import { GradeCountCard } from './grade-count-card'
import { TotalSummaryTile } from './total-summary-tile'
import { MainActionTile } from './main-action-tile'
import { ResetConfirmationDialog } from './reset-confirmation-dialog'
import { History, Calendar, RotateCcw } from 'lucide-react'

interface MainCountingScreenProps {
  onNavigateToHistory: () => void
  onNavigateToDate: () => void
}

export function MainCountingScreen({
  onNavigateToHistory,
  onNavigateToDate,
}: MainCountingScreenProps) {
  const [showResetDialog, setShowResetDialog] = useState(false)

  // Mock totals
  const totalGradeA = 308
  const totalGradeB = 222
  const totalCombined = 530

  return (
    <div className="min-h-screen bg-gray-50">
      <CoconutHeader title="COCONUT COUNTING FORM" />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="space-y-8">
          {/* Count Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
            <GradeCountCard
              grade="A"
              type="fixed"
              fixedCount={200}
              label="GARDE A — 200 × 1"
              value={200}
            />
            <GradeCountCard
              grade="B"
              type="fixed"
              fixedCount={400}
              label="GARDE B — 400/200 × 1"
              value={200}
            />
            <GradeCountCard
              grade="A"
              type="manual"
              maxCount={199}
              label="GARDE A — UP TO 199"
              value={0}
            />
            <GradeCountCard
              grade="B"
              type="manual"
              maxCount={199}
              label="GARDE B — UP TO 199"
              value={0}
            />
          </div>

          {/* Total Summary Tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
            <TotalSummaryTile type="grade-a" value={totalGradeA} />
            <TotalSummaryTile type="grade-b" value={totalGradeB} />
            <TotalSummaryTile type="combined" value={totalCombined} />
          </div>

          {/* Action Tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            <MainActionTile
              type="history"
              title="TODAY'S HISTORY"
              subtitle="View today's count entries and totals."
              icon={History}
              onClick={onNavigateToHistory}
            />
            <MainActionTile
              type="date"
              title="SELECT DATE"
              subtitle="View counts from another day."
              icon={Calendar}
              onClick={onNavigateToDate}
            />
            <MainActionTile
              type="reset"
              title="RESET CURRENT COUNT"
              subtitle="Start a fresh active count without deleting history."
              icon={RotateCcw}
              onClick={() => setShowResetDialog(true)}
            />
          </div>
        </div>
      </main>

      {/* Reset Confirmation Dialog */}
      <ResetConfirmationDialog
        isOpen={showResetDialog}
        onCancel={() => setShowResetDialog(false)}
        onConfirm={() => {
          setShowResetDialog(false)
          // Reset logic would go here in Phase 2
        }}
      />
    </div>
  )
}
