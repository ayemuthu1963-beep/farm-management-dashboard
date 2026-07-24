/**
 * Compact total tile for totals row
 * Shows label and value
 */

interface CompactTotalTileProps {
  label: string
  value: number
  variant: 'a' | 'b' | 'combined'
}

export function CompactTotalTile({
  label,
  value,
  variant,
}: CompactTotalTileProps) {
  const borderColor =
    variant === 'a'
      ? 'border-green-500'
      : variant === 'b'
        ? 'border-blue-500'
        : 'border-teal-500'

  const textColor =
    variant === 'a'
      ? 'text-green-700'
      : variant === 'b'
        ? 'text-blue-700'
        : 'text-teal-700'

  return (
    <div
      className={`
        flex-1 border-2 ${borderColor} rounded-lg px-3 py-2 text-center
        bg-gradient-to-b from-gray-50 to-white
      `}
    >
      <p className={`text-xs font-semibold ${textColor}`}>{label}</p>
      <p className={`text-xl font-bold ${textColor}`}>{value}</p>
    </div>
  )
}
