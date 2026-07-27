export function ActionButtons() {
  return (
    <div className="grid grid-cols-3 gap-3">
      <button className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 transition-colors">
        <span>🕐</span>
        <span>HISTORY</span>
      </button>
      <button className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 transition-colors">
        <span>📅</span>
        <span>DATE</span>
      </button>
      <button className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 transition-colors">
        <span>⟳</span>
        <span>RESET</span>
      </button>
    </div>
  )
}
