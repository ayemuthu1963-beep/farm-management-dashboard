interface TotalTilesProps {
  totalA: number
  totalB: number
  totalAB: number
}

export function TotalTiles({ totalA, totalB, totalAB }: TotalTilesProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-lg border border-green-200 bg-green-50 px-2 py-2 text-center">
        <p className="text-xs font-semibold text-green-700">TOTAL A</p>
        <p className="text-xl font-bold text-green-700 mt-1">{totalA}</p>
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-2 text-center">
        <p className="text-xs font-semibold text-blue-700">TOTAL B</p>
        <p className="text-xl font-bold text-blue-700 mt-1">{totalB}</p>
      </div>
      <div className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-2 text-center">
        <p className="text-xs font-semibold text-teal-700">TOTAL A+B</p>
        <p className="text-xl font-bold text-teal-700 mt-1">{totalAB}</p>
      </div>
    </div>
  )
}
