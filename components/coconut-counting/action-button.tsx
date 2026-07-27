/**
 * Action button for bottom action bar
 * HISTORY, DATE, RESET buttons
 */

interface ActionButtonProps {
  icon: string
  label: string
  variant: 'history' | 'date' | 'reset'
  onClick?: () => void
}

export function ActionButton({ icon, label, variant, onClick }: ActionButtonProps) {
  const colors =
    variant === 'history'
      ? 'bg-teal-600 hover:bg-teal-700'
      : variant === 'date'
        ? 'bg-blue-600 hover:bg-blue-700'
        : 'bg-orange-600 hover:bg-orange-700'

  return (
    <button
      onClick={onClick}
      className={`${colors} text-white font-bold py-3 px-4 rounded-lg flex-1 transition-colors flex items-center justify-center gap-2`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm">{label}</span>
    </button>
  )
}
