/**
 * Summary tiles for history pages
 * Shows totals and entry count
 */

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
    <div className="grid grid-cols-4 gap-2">
      {/* Total A */}
      <div className="border-2 border-green-500 rounded-lg px-3 py-2 bg-green-50 text-center">
        <p className="text-xs font-semibold text-green-700">TOTAL A</p>
        <p className="text-xl font-bold text-green-800">{totalA}</p>
      </div>

      {/* Total B */}
      <div className="border-2 border-blue-500 rounded-lg px-3 py-2 bg-blue-50 text-center">
        <p className="text-xs font-semibold text-blue-700">TOTAL B</p>
        <p className="text-xl font-bold text-blue-800">{totalB}</p>
      </div>

      {/* Total A+B */}
      <div className="border-2 border-teal-500 rounded-lg px-3 py-2 bg-teal-50 text-center">
        <p className="text-xs font-semibold text-teal-700">TOTAL A+B</p>
        <p className="text-xl font-bold text-teal-800">{totalAB}</p>
      </div>

      {/* Entries count */}
      <div className="border-2 border-orange-500 rounded-lg px-3 py-2 bg-orange-50 text-center">
        <p className="text-xs font-semibold text-orange-700">ENTRIES</p>
        <p className="text-xl font-bold text-orange-800">{entriesCount}</p>
      </div>
    </div>
  )
}
