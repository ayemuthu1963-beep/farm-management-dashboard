'use client'

import { Leaf } from 'lucide-react'

interface MobileHeaderProps {
  todayDate?: string
  showBackButton?: boolean
  onBack?: () => void
}

export function MobileHeader({
  todayDate = '24-07-2026',
  showBackButton = false,
  onBack,
}: MobileHeaderProps) {
  return (
    <div className="w-full bg-gradient-to-b from-green-800 to-green-700 px-3 py-2">
      {/* First line: Leaf + Title + Coconut */}
      <div className="flex items-center justify-between gap-2">
        <Leaf className="h-5 w-5 text-yellow-100 flex-shrink-0" />
        <h1 className="flex-1 text-center text-sm font-bold text-white tracking-tight">
          COCONUT COUNTING FORM
        </h1>
        <span className="text-lg text-yellow-200 flex-shrink-0">🥥</span>
      </div>
      
      {/* Second line: Date */}
      <div className="text-center text-xs font-semibold text-yellow-100 mt-0.5">
        TODAY: {todayDate}
      </div>
    </div>
  )
}
