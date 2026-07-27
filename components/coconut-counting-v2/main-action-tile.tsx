'use client'

import { LucideIcon } from 'lucide-react'

interface MainActionTileProps {
  type: 'history' | 'date' | 'reset'
  title: string
  subtitle: string
  icon: LucideIcon
  onClick: () => void
}

export function MainActionTile({
  type,
  title,
  subtitle,
  icon: Icon,
  onClick,
}: MainActionTileProps) {
  const configs = {
    history: {
      headerBg: 'bg-teal-600',
      contentBg: 'bg-teal-50',
      borderColor: 'border-teal-200',
      textColor: 'text-teal-900',
      iconColor: 'text-teal-600',
    },
    date: {
      headerBg: 'bg-blue-600',
      contentBg: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-900',
      iconColor: 'text-blue-600',
    },
    reset: {
      headerBg: 'bg-orange-600',
      contentBg: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-900',
      iconColor: 'text-orange-600',
    },
  }

  const config = configs[type]

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border-2 ${config.borderColor} ${config.contentBg} overflow-hidden shadow-sm transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95`}
    >
      {/* Header */}
      <div className={`${config.headerBg} px-4 py-3 sm:px-6 sm:py-4 flex items-center gap-3`}>
        <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
        <span className="text-base sm:text-lg font-bold text-white uppercase tracking-wide text-left">
          {title}
        </span>
      </div>

      {/* Content */}
      <div className="px-4 py-4 sm:px-6 sm:py-5 text-left">
        <p className={`text-sm sm:text-base ${config.textColor} font-medium`}>
          {subtitle}
        </p>
      </div>
    </button>
  )
}
