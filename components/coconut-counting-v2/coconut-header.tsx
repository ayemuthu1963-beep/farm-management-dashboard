'use client'

import { Leaf, ChevronLeft } from 'lucide-react'

interface CoconutHeaderProps {
  title: string
  showBackButton?: boolean
  onBack?: () => void
  todayDate?: string
}

export function CoconutHeader({
  title,
  showBackButton = false,
  onBack,
  todayDate = '24-07-2026',
}: CoconutHeaderProps) {
  return (
    <div className="w-full bg-gradient-to-r from-green-700 to-green-800 px-4 py-4 sm:px-6 sm:py-6">
      {/* Back button and title row */}
      <div className="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-0">
        {showBackButton && (
          <button
            onClick={onBack}
            className="rounded-lg p-2 hover:bg-green-600 transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
        )}
        <Leaf className="h-7 w-7 sm:h-8 sm:w-8 text-yellow-200 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-white tracking-wide truncate">
            COCONUT COUNTING FORM
          </h1>
          {/* Mobile date display - shown below title on small screens */}
          <p className="text-xs sm:hidden text-yellow-100 font-semibold mt-1">
            TODAY: {todayDate}
          </p>
        </div>
        {/* Desktop date display - shown on the right on larger screens */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <p className="text-sm font-semibold text-yellow-100">TODAY: {todayDate}</p>
          <span className="text-2xl text-yellow-200">🥥</span>
        </div>
      </div>
    </div>
  )
}
