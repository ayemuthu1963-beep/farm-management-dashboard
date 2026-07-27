interface ABCounterRowProps {
  counterA: number
  counterB: number
}

export function ABCounterRow({ counterA, counterB }: ABCounterRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border-4 border-red-400 bg-white p-3">
        <label className="block text-center text-xs font-bold text-gray-700 mb-2">
          A counter
        </label>
        <input
          type="text"
          value={counterA}
          readOnly
          className="w-full rounded-lg border-2 border-blue-400 bg-blue-50 px-3 py-2 text-center text-2xl font-bold text-gray-900 focus:outline-none"
        />
      </div>
      <div className="rounded-2xl border-4 border-red-400 bg-white p-3">
        <label className="block text-center text-xs font-bold text-gray-700 mb-2">
          B counter
        </label>
        <input
          type="text"
          value={counterB}
          readOnly
          className="w-full rounded-lg border-2 border-blue-400 bg-blue-50 px-3 py-2 text-center text-2xl font-bold text-gray-900 focus:outline-none"
        />
      </div>
    </div>
  )
}
