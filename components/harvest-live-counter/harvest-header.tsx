'use client'

import { Leaf, RefreshCw } from 'lucide-react'
import type { ConnectionStatus } from '@/lib/harvest-live-counter-mock'

interface HarvestHeaderProps {
  connectionStatus: ConnectionStatus
  lastUpdated: string
  onRefresh?: () => void
}

export function HarvestHeader({
  connectionStatus,
  lastUpdated,
  onRefresh,
}: HarvestHeaderProps) {
  const isLive = connectionStatus === 'live'

  return (
    <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex max-w-4xl items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Leaf className="h-6 w-6 text-green-600 sm:h-8 sm:w-8" />
          <h1 className="text-lg font-bold text-gray-900 sm:text-2xl">
            MFMS Harvest Live Counter
          </h1>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:px-4 sm:py-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="mx-auto mt-3 max-w-4xl flex items-center gap-2 text-sm text-gray-600">
        <div className={`h-2 w-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        <span className="font-medium">
          {isLive ? 'Live' : 'Offline'}
        </span>
        <span className="text-gray-500">
          Last updated: {lastUpdated}
        </span>
      </div>
    </header>
  )
}
