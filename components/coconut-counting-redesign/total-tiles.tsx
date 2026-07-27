interface TotalTilesProps {
  totalA: number
  totalB: number
  totalAB: number
}

export function TotalTiles({ totalA, totalB, totalAB }: TotalTilesProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border-2 border-green-300 bg-green-50 px-4 py-4 text-center">
        <p className="text-xs font-semibold text-green-700">TOTAL A</p>
        <p className="text-2xl font-bold text-green-700 mt-2">{totalA}</p>
      </div>
      <div className="rounded-xl border-2 border-blue-300 bg-blue-50 px-4 py-4 text-center">
        <p className="text-xs font-semibold text-blue-700">TOTAL B</p>
        <p className="text-2xl font-bold text-blue-700 mt-2">{totalB}</p>
      </div>
      <div className="rounded-xl border-2 border-teal-300 bg-teal-50 px-4 py-4 text-center">
        <p className="text-xs font-semibold text-teal-700">TOTAL A+B</p>
        <p className="text-2xl font-bold text-teal-700 mt-2">{totalAB}</p>
      </div>
    </div>
  )
}
