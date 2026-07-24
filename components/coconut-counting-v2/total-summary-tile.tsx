'use client'

import { Calculator, Plus } from 'lucide-react'

interface TotalSummaryTileProps {
  type: 'grade-a' | 'grade-b' | 'combined'
  value: number
}

export function TotalSummaryTile({ type, value }: TotalSummaryTileProps) {
  const configs = {
    'grade-a': {
      headerBg: 'bg-green-600',
      contentBg: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-900',
      valueColor: 'text-green-700',
      title: 'TOTAL GRADE A',
      icon: Calculator,
    },
    'grade-b': {
      headerBg: 'bg-blue-600',
      contentBg: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-900',
      valueColor: 'text-blue-700',
      title: 'TOTAL GRADE B',
      icon: Calculator,
    },
    'combined': {
      headerBg: 'bg-teal-600',
      contentBg: 'bg-teal-50',
      borderColor: 'border-teal-200',
      textColor: 'text-teal-900',
      valueColor: 'text-teal-700',
      title: 'TOTAL COCONUTS — A + B',
      icon: Plus,
    },
  }

  const config = configs[type]
  const Icon = config.icon

  return (
    <div className={`rounded-2xl border-2 ${config.borderColor} ${config.contentBg} overflow-hidden shadow-sm transition-shadow hover:shadow-md`}>
      {/* Header */}
      <div className={`${config.headerBg} px-4 py-2 sm:px-6 sm:py-3 flex items-center justify-between`}>
        <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide">
          {config.title}
        </span>
        <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white opacity-80" />
      </div>

      {/* Value */}
      <div className="px-4 py-6 sm:px-6 sm:py-8 text-center">
        <div className={`text-5xl sm:text-6xl lg:text-7xl font-bold ${config.valueColor}`}>
          {value.toLocaleString()}
        </div>
      </div>
    </div>
  )
}
