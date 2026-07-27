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
    <div className="space-y-3">
      {/* Total nuts harvested - prominent primary input */}
      <div className="rounded-2xl border-4 border-red-400 bg-white p-3">
        <label className="block text-center text-sm font-bold text-gray-700 mb-2">
          Total nuts Harvested
        </label>
        <input
          type="text"
          value={totalNutsHarvested}
          readOnly
          className="w-full rounded-lg border-2 border-blue-400 bg-blue-50 px-4 py-4 text-center text-3xl font-bold text-gray-900 focus:outline-none"
        />
      </div>

      {/* A1 counter and B1 counter row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border-4 border-red-400 bg-white p-3">
          <label className="block text-center text-xs font-bold text-gray-700 mb-2">
            A1 counter
          </label>
          <input
            type="text"
            value={counterA1}
            readOnly
            className="w-full rounded-lg border-2 border-blue-400 bg-blue-50 px-3 py-2 text-center text-2xl font-bold text-gray-900 focus:outline-none"
          />
        </div>
        <div className="rounded-2xl border-4 border-red-400 bg-white p-3">
          <label className="block text-center text-xs font-bold text-gray-700 mb-2">
            B1 counter
          </label>
          <input
            type="text"
            value={counterB1}
            readOnly
            className="w-full rounded-lg border-2 border-blue-400 bg-blue-50 px-3 py-2 text-center text-2xl font-bold text-gray-900 focus:outline-none"
          />
        </div>
      </div>

      {/* B2 counter - centered supporting tile */}
      <div className="mx-auto max-w-xs rounded-2xl border-4 border-red-400 bg-white p-3">
        <label className="block text-center text-xs font-bold text-gray-700 mb-2">
          B2 counter
        </label>
        <input
          type="text"
          value={counterB2}
          readOnly
          className="w-full rounded-lg border-2 border-blue-400 bg-blue-50 px-3 py-2 text-center text-2xl font-bold text-gray-900 focus:outline-none"
        />
      </div>
    </div>
  )
}
