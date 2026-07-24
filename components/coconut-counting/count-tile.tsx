/**
 * Count tile for 2×2 grid on main counting screen
 * Shows fixed or manual count with SEND button
 */

interface CountTileProps {
  grade: 'A' | 'B'
  type: 'fixed' | 'manual'
  title: string
  badgeLabel: string
  value: number
  onSend?: () => void
}

export function CountTile({
  grade,
  type,
  title,
  badgeLabel,
  value,
  onSend,
}: CountTileProps) {
  const isGradeA = grade === 'A'
  const headerColor = isGradeA ? 'bg-green-600' : 'bg-blue-600'
  const buttonColor = isGradeA ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
  const badgeColor = isGradeA ? 'bg-green-500' : 'bg-blue-500'

  return (
    <div className="flex flex-col rounded-xl overflow-hidden shadow-md">
      {/* Header with title */}
      <div className={`${headerColor} text-white px-4 py-3`}>
        <p className="font-bold text-sm text-center">{title}</p>
      </div>

      {/* Content area */}
      <div className="bg-gradient-to-b from-gray-50 to-white px-4 py-4 flex-1 flex flex-col items-center justify-center gap-2">
        {/* Badge and icon */}
        <div className="flex items-center gap-2">
          <div
            className={`${badgeColor} text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-xs`}
          >
            {badgeLabel}
          </div>
          <span className="text-2xl">🥥</span>
        </div>

        {/* Count value */}
        <div className="text-4xl font-bold text-gray-900">{value}</div>

        {/* Input for manual type */}
        {type === 'manual' && (
          <input
            type="text"
            placeholder="1-199"
            className="w-full text-center py-2 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400"
            readOnly
          />
        )}
      </div>

      {/* Send button */}
      <button
        onClick={onSend}
        className={`${buttonColor} text-white font-bold py-3 px-4 transition-colors flex items-center justify-center gap-2`}
      >
        <span>➤</span>
        <span>SEND</span>
      </button>
    </div>
  )
}
