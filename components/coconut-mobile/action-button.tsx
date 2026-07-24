'use client'

import { LucideIcon } from 'lucide-react'

interface ActionButtonProps {
  icon: LucideIcon
  label: string
  variant: 'history' | 'date' | 'reset'
  onClick?: () => void
}

export function ActionButton({ icon: Icon, label, variant, onClick }: ActionButtonProps) {
  const colors = {
    history: 'bg-teal-600 hover:bg-teal-700 text-white',
    date: 'bg-blue-600 hover:bg-blue-700 text-white',
    reset: 'bg-orange-600 hover:bg-orange-700 text-white',
  }

  return (
    <button
      onClick={onClick}
      className={`${colors[variant]} rounded-lg py-2 px-3 flex flex-col items-center justify-center gap-1 font-semibold transition-colors flex-1`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs">{label}</span>
    </button>
  )
}
