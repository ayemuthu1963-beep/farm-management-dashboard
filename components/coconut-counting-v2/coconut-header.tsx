'use client'

import { Leaf, ChevronLeft } from 'lucide-react'

interface CoconutHeaderProps {
  title: string
  showBackButton?: boolean
  onBack?: () => void
}

export function CoconutHeader({
  title,
  showBackButton = false,
  onBack,
}: CoconutHeaderProps) {
  return (
    <div className="w-full bg-gradient-to-r from-green-700 to-green-800 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-4">
        {showBackButton && (
          <button
            onClick={onBack}
            className="rounded-lg p-2 hover:bg-green-600 transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
        )}
        <Leaf className="h-8 w-8 text-yellow-100" />
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wide">
          {title}
        </h1>
      </div>
    </div>
  )
}
