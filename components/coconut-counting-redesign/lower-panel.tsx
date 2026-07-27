interface LowerPanelProps {
  totalNutsHarvested: number
  counterA1: number
  counterB1: number
  counterB2: number
}

export function LowerPanel({
  totalNutsHarvested,
  counterA1,
  counterB1,
  counterB2,
}: LowerPanelProps) {
  return (
    <div className="space-y-2">
      {/* Total nuts harvested - green gradient panel */}
      <div className="rounded-lg bg-gradient-to-r from-green-600 to-teal-600 p-3">
        <label className="block text-center text-xs font-bold text-white mb-2">
          Total nuts Harvested
        </label>
        <input
          type="text"
          value={totalNutsHarvested}
          readOnly
          className="w-full rounded border border-white bg-white px-3 py-2 text-center text-2xl font-bold text-gray-900 focus:outline-none"
        />
      </div>

      {/* A1, B1, B2 counter row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-green-200 bg-green-50 p-2">
          <label className="block text-center text-xs font-bold text-gray-700 mb-1">
            A1 counter
          </label>
          <input
            type="text"
            value={counterA1}
            readOnly
            className="w-full rounded border border-green-300 bg-white px-2 py-1 text-center text-lg font-bold text-green-600 focus:outline-none"
          />
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
          <label className="block text-center text-xs font-bold text-gray-700 mb-1">
            B1 counter
          </label>
          <input
            type="text"
            value={counterB1}
            readOnly
            className="w-full rounded border border-blue-300 bg-white px-2 py-1 text-center text-lg font-bold text-blue-600 focus:outline-none"
          />
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
          <label className="block text-center text-xs font-bold text-gray-700 mb-1">
            B2 counter
          </label>
          <input
            type="text"
            value={counterB2}
            readOnly
            className="w-full rounded border border-blue-300 bg-white px-2 py-1 text-center text-lg font-bold text-blue-600 focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
