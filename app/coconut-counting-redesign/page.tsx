'use client'

import { CoconutHeader } from '@/components/coconut-counting-redesign/header'
import { CountTile } from '@/components/coconut-counting-redesign/count-tile'
import { ABCounterRow } from '@/components/coconut-counting-redesign/ab-counter-row'
import { TotalTiles } from '@/components/coconut-counting-redesign/total-tiles'
import { LowerPanel } from '@/components/coconut-counting-redesign/lower-panel'
import { ActionButtons } from '@/components/coconut-counting-redesign/action-buttons'

export default function CoconutCountingRedesignPage() {
  // Mock data - static values for UI prototype
  const mockData = {
    gradeA200: 200,
    gradeB200: 200,
    gradeA99: 45,
    gradeB99: 38,
    totalA: 3338,
    totalB: 2000,
    totalAB: 5338,
    totalNutsHarvested: 5338,
    counterA: 3338,
    counterB: 2000,
    counterA1: 2000,
    counterB1: 1000,
    counterB2: 338,
  }

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-sm">
        <CoconutHeader />

        <main className="px-3 py-4 space-y-4">
        {/* Four counting tiles - 2x2 grid */}
        <div className="grid grid-cols-2 gap-4">
          <CountTile
            title="GRADE A — 200"
            grade="A"
            count={mockData.gradeA200}
            variant="fixed"
          />
          <CountTile
            title="GRADE B — 200"
            grade="B"
            count={mockData.gradeB200}
            variant="fixed"
          />
          <CountTile
            title="GRADE A — 1 TO 99 PAIRS"
            grade="A"
            count={mockData.gradeA99}
            variant="manual"
          />
          <CountTile
            title="GRADE B — 1 TO 99 PAIRS"
            grade="B"
            count={mockData.gradeB99}
            variant="manual"
          />
        </div>

        {/* A counter and B counter row */}
        <ABCounterRow
          counterA={mockData.counterA}
          counterB={mockData.counterB}
        />

        {/* Totals row */}
        <TotalTiles
          totalA={mockData.totalA}
          totalB={mockData.totalB}
          totalAB={mockData.totalAB}
        />

        {/* Lower panel with input and counters */}
        <LowerPanel
          totalNutsHarvested={mockData.totalNutsHarvested}
          counterA1={mockData.counterA1}
          counterB1={mockData.counterB1}
          counterB2={mockData.counterB2}
        />

        {/* Action buttons */}
        <ActionButtons />
      </main>
      </div>
    </div>
  )
}
