'use client'

import { Circle } from 'lucide-react'

interface GradeCountCardProps {
  grade: 'A' | 'B'
  type: 'fixed' | 'manual'
  fixedCount?: number
  label: string
  maxCount?: number
  value: number
}

export function GradeCountCard({
  grade,
  type,
  fixedCount,
  label,
  maxCount,
  value,
}: GradeCountCardProps) {
  const isGradeA = grade === 'A'
  const baseColor = isGradeA ? 'green' : 'blue'
  const bgColor = isGradeA ? 'bg-green-50' : 'bg-blue-50'
  const headerBg = isGradeA ? 'bg-green-600' : 'bg-blue-600'
  const borderColor = isGradeA ? 'border-green-200' : 'border-blue-200'
  const textColor = isGradeA ? 'text-green-900' : 'text-blue-900'
  const labelColor = isGradeA ? 'text-green-700' : 'text-blue-700'
  const buttonBg = isGradeA ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'

  return (
    <div className={`rounded-2xl border-2 ${borderColor} ${bgColor} overflow-hidden shadow-sm transition-shadow hover:shadow-md`}>
      {/* Header */}
      <div className={`${headerBg} px-4 py-3 sm:px-6 sm:py-4`}>
        <div className="flex items-center justify-between">
          <span className="text-sm sm:text-base font-bold text-white uppercase tracking-wide">
            GRADE {grade}
            {type === 'fixed' && fixedCount && ` — ${fixedCount} × 1`}
            {type === 'manual' && maxCount && ` — UP TO ${maxCount}`}
          </span>
          <div className={`rounded-full bg-white bg-opacity-90 p-2 flex items-center justify-center`}>
            <span className={`text-lg sm:text-2xl font-bold ${labelColor}`}>
              {isGradeA ? 'A' : 'B'}{type === 'fixed' ? '1' : '2'}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-4">
        <div>
          <p className={`text-xs sm:text-sm font-semibold uppercase tracking-wide ${labelColor} mb-2`}>
            COUNT
          </p>
          {type === 'fixed' ? (
            <div className="text-4xl sm:text-5xl font-bold text-gray-900">
              {fixedCount}
            </div>
          ) : (
            <input
              type="number"
              min="0"
              max={maxCount}
              className={`w-full rounded-lg border-2 ${borderColor} ${bgColor} px-4 py-3 text-3xl sm:text-4xl font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all`}
              placeholder={`0 to ${maxCount}`}
            />
          )}
        </div>

        {type === 'fixed' && (
          <p className="text-xs sm:text-sm text-gray-600">
            1 to {fixedCount}
          </p>
        )}
      </div>

      {/* Send Button */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-t-2 border-opacity-20">
        <button className={`w-full ${buttonBg} text-white font-bold py-3 sm:py-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-base sm:text-lg`}>
          <span>✈️</span>
          SEND
        </button>
      </div>
    </div>
  )
}
