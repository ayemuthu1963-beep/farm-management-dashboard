interface ABCounterRowProps {
  counterA: number
  counterB: number
}

export function ABCounterRow({ counterA, counterB }: ABCounterRowProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-green-200 bg-green-50 p-2">
        <label className="block text-center text-xs font-bold text-gray-700 mb-1">
          A counter
        </label>
        <input
          type="text"
          value={counterA}
          readOnly
          className="w-full rounded border border-green-300 bg-white px-2 py-1 text-center text-xl font-bold text-green-600 focus:outline-none"
        />
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
        <label className="block text-center text-xs font-bold text-gray-700 mb-1">
          B counter
        </label>
        <input
          type="text"
          value={counterB}
          readOnly
          className="w-full rounded border border-blue-300 bg-white px-2 py-1 text-center text-xl font-bold text-blue-600 focus:outline-none"
        />
      </div>
    </div>
  )
}
