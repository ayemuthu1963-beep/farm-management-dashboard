'use client'

import { Calculator, ListChecks } from 'lucide-react'

interface HistorySummaryTilesProps {
  totalA: number
  totalB: number
  totalAB: number
  entriesCount: number
}

export function HistorySummaryTiles({
  totalA,
  totalB,
  totalAB,
  entriesCount,
}: HistorySummaryTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {/* Total A */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          <Calculator className="h-4 w-4 text-green-700" />
          <p className="text-xs font-semibold text-green-700">TOTAL A</p>
        </div>
        <p className="text-2xl font-bold text-green-900">{totalA}</p>
      </div>

      {/* Total B */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          <Calculator className="h-4 w-4 text-blue-700" />
          <p className="text-xs font-semibold text-blue-700">TOTAL B</p>
        </div>
        <p className="text-2xl font-bold text-blue-900">{totalB}</p>
      </div>

      {/* Total A+B */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          <Calculator className="h-4 w-4 text-teal-700" />
          <p className="text-xs font-semibold text-teal-700">TOTAL A+B</p>
        </div>
        <p className="text-2xl font-bold text-teal-900">{totalAB}</p>
      </div>

      {/* Entries */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          <ListChecks className="h-4 w-4 text-orange-700" />
          <p className="text-xs font-semibold text-orange-700">ENTRIES</p>
        </div>
        <p className="text-2xl font-bold text-orange-900">{entriesCount}</p>
      </div>
    </div>
  )
}
