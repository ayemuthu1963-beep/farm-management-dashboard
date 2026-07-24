/**
 * Compact mobile header for Coconut Counting Form
 * Shows title and today's date
 * Mobile-only Android portrait
 */

interface CoconutCountingHeaderProps {
  todayDate: string
}

export function CoconutCountingHeader({ todayDate }: CoconutCountingHeaderProps) {
  return (
    <div className="w-full bg-gradient-to-r from-green-700 to-green-800 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Leaf icon */}
        <div className="text-2xl flex-shrink-0">🌿</div>

        {/* Center: Title */}
        <div className="flex-1 text-center">
          <h1 className="text-white font-bold text-lg tracking-wider">COCONUT COUNTING FORM</h1>
          <p className="text-yellow-100 text-sm font-semibold">TODAY: {todayDate}</p>
        </div>

        {/* Right: Coconut icon */}
        <div className="text-2xl flex-shrink-0">🥥</div>
      </div>
    </div>
  )
}
