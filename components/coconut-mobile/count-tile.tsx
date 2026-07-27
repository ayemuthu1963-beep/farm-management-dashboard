'use client'

import { Send } from 'lucide-react'

interface CountTileProps {
  grade: 'A' | 'B'
  type: 'fixed' | 'manual'
  title: string
  fixedValue?: number
  badgeIcon?: string
  coconutEmoji?: string
}

export function CountTile({
  grade,
  type,
  title,
  fixedValue,
  badgeIcon = grade === 'A' ? 'A1' : 'B1',
  coconutEmoji = '🥥',
}: CountTileProps) {
  const isGradeA = grade === 'A'
  const headerColor = isGradeA ? 'bg-green-700' : 'bg-blue-600'
  const bgColor = isGradeA ? 'bg-green-50' : 'bg-blue-50'
  const buttonColor = isGradeA ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
  const badgeColor = isGradeA ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'

  return (
    <div className={`${bgColor} rounded-lg border-2 ${isGradeA ? 'border-green-200' : 'border-blue-200'} overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className={`${headerColor} px-2 py-1.5 text-white text-center`}>
        <p className="text-xs font-bold tracking-tight">{title}</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-2 py-2 flex flex-col items-center justify-center gap-1">
        {/* Badge and Icon */}
        <div className="flex items-center gap-1">
          <span className={`${badgeColor} rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold`}>
            {badgeIcon}
          </span>
          <span className="text-lg">{coconutEmoji}</span>
        </div>

        {/* Value */}
        {type === 'fixed' ? (
          <p className="text-2xl font-bold text-gray-900">{fixedValue}</p>
        ) : (
          <input
            type="number"
            placeholder="1–199"
            className="w-full text-center text-xl font-bold rounded border border-gray-300 py-1 px-1"
            min="1"
            max="199"
          />
        )}
      </div>

      {/* Send Button */}
      <button className={`${buttonColor} text-white font-bold py-2 px-2 flex items-center justify-center gap-1 text-sm transition-colors`}>
        <Send className="h-4 w-4" />
        SEND
      </button>
    </div>
  )
}
