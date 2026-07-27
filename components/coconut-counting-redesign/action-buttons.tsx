export function ActionButtons() {
  return (
    <div className="grid grid-cols-3 gap-2">
      <button className="flex items-center justify-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-2 transition-colors text-sm">
        <span>🕐</span>
        <span>HISTORY</span>
      </button>
      <button className="flex items-center justify-center gap-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-2 transition-colors text-sm">
        <span>📅</span>
        <span>DATE</span>
      </button>
      <button className="flex items-center justify-center gap-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-2 transition-colors text-sm">
        <span>⟳</span>
        <span>RESET</span>
      </button>
    </div>
  )
}
