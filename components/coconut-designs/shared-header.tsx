export function SharedHeader() {
  return (
    <>
      <div className="bg-gradient-to-r from-green-600 to-green-500 text-white px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">COCONUT COUNTING FORM</h1>
            <p className="text-sm text-green-100 mt-1">TODAY: 25-07-2026 · ONLINE</p>
          </div>
          <div className="text-4xl">🥥</div>
        </div>
      </div>

      {/* Grade Tiles */}
      <div className="px-4 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
            <div className="text-2xl font-bold text-green-700 mb-1">200</div>
            <div className="text-xs font-semibold text-green-600">GRADE A — 200</div>
            <div className="text-xs text-gray-600 mt-2">FIXED COUNT</div>
            <button className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 px-3 rounded">
              ▶ SEND
            </button>
          </div>

          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 text-center">
            <div className="text-2xl font-bold text-blue-700 mb-1">200</div>
            <div className="text-xs font-semibold text-blue-600">GRADE B — 200</div>
            <div className="text-xs text-gray-600 mt-2">FIXED COUNT</div>
            <button className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-3 rounded">
              ▶ SEND
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
            <div className="text-xs font-semibold text-green-600 mb-2">GRADE A — 1 TO 99 PAIRS</div>
            <input type="text" value="1-99" readOnly className="w-full text-center text-lg font-semibold border border-gray-300 rounded px-2 py-1 bg-white text-gray-700" />
            <div className="text-xs text-gray-600 mt-2">ENTER PAIRS</div>
            <button className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 px-3 rounded">
              ▶ SEND
            </button>
          </div>

          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 text-center">
            <div className="text-xs font-semibold text-blue-600 mb-2">GRADE B — 1 TO 99 PAIRS</div>
            <input type="text" value="1-99" readOnly className="w-full text-center text-lg font-semibold border border-gray-300 rounded px-2 py-1 bg-white text-gray-700" />
            <div className="text-xs text-gray-600 mt-2">ENTER PAIRS</div>
            <button className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-3 rounded">
              ▶ SEND
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-green-50 rounded-lg border border-green-200 p-3">
          <div className="text-center">
            <div className="text-lg font-bold text-green-700">3338</div>
            <div className="text-xs font-semibold text-green-600">TOTAL A</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-700">2000</div>
            <div className="text-xs font-semibold text-blue-600">TOTAL B</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-teal-700">5338</div>
            <div className="text-xs font-semibold text-teal-600">TOTAL A+B</div>
          </div>
        </div>
      </div>
    </>
  )
}

export function SharedFooter() {
  return (
    <div className="px-4 py-4 flex gap-3">
      <button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2">
        ⏱ HISTORY
      </button>
      <button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2">
        📅 DATE
      </button>
      <button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2">
        🔄 RESET
      </button>
    </div>
  )
}
