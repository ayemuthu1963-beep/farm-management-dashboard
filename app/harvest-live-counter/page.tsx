'use client'

import { useState } from 'react'
import { HarvestHeader } from '@/components/harvest-live-counter/harvest-header'
import { TodayNutsCard } from '@/components/harvest-live-counter/today-nuts-card'
import { HarvestSummaryCards } from '@/components/harvest-live-counter/harvest-summary-cards'
import { HarvestStatusCard } from '@/components/harvest-live-counter/harvest-status-card'
import { PreviousHarvestDays } from '@/components/harvest-live-counter/previous-harvest-days'
import { DuplicateWarning } from '@/components/harvest-live-counter/duplicate-warning'
import { TargetControl } from '@/components/harvest-live-counter/target-control'
import {
  HARVEST_LIVE_COUNTER_MOCK,
  HARVEST_LIVE_COUNTER_OFFLINE,
  HARVEST_LIVE_COUNTER_EMPTY,
  HARVEST_LIVE_COUNTER_NEAR_TARGET,
  HARVEST_LIVE_COUNTER_TARGET_REACHED,
  getHarvestState,
  type HarvestLiveCounterData,
} from '@/lib/harvest-live-counter-mock'

// Demo state selector (development only)
const DEMO_STATES = {
  'Live': HARVEST_LIVE_COUNTER_MOCK,
  'Near Target': HARVEST_LIVE_COUNTER_NEAR_TARGET,
  'Target Reached': HARVEST_LIVE_COUNTER_TARGET_REACHED,
  'Offline': HARVEST_LIVE_COUNTER_OFFLINE,
  'Empty': HARVEST_LIVE_COUNTER_EMPTY,
} as const

export default function HarvestLiveCounterPage() {
  const [selectedDemo, setSelectedDemo] = useState<keyof typeof DEMO_STATES>('Live')
  const [data, setData] = useState<HarvestLiveCounterData>(DEMO_STATES[selectedDemo])
  const [targetValue, setTargetValue] = useState(data.targetNuts)

  const handleDemoSelect = (state: keyof typeof DEMO_STATES) => {
    setSelectedDemo(state)
    const newData = DEMO_STATES[state]
    setData(newData)
    setTargetValue(newData.targetNuts)
  }

  const handleRefresh = () => {
    // Mock refresh - in Phase 3, this will call the real API
    setData({
      ...data,
      lastUpdated: new Date().toLocaleTimeString('en-US'),
      lastUpdatedFull: new Date().toISOString(),
    })
  }

  const handleSaveTarget = (newTarget: number) => {
    setTargetValue(newTarget)
    setData({ ...data, targetNuts: newTarget })
  }

  const harvestState = getHarvestState(data)

  return (
    <div className="min-h-screen bg-gray-50">
      <HarvestHeader
        connectionStatus={data.connectionStatus}
        lastUpdated={data.lastUpdated}
        onRefresh={handleRefresh}
      />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          {/* Today's Nuts Card */}
          <TodayNutsCard
            todayNuts={data.todayNuts}
            targetNuts={targetValue}
          />

          {/* Summary Cards */}
          <HarvestSummaryCards
            treesHarvested={data.treesHarvested}
            totalBunches={data.totalBunches}
            submissionCount={data.submissionCount}
          />

          {/* Status Card - Only One at a Time */}
          <HarvestStatusCard
            state={harvestState}
            todayNuts={data.todayNuts}
            targetNuts={targetValue}
            lastUpdated={data.lastUpdated}
          />

          {/* Offline Notice (if offline) */}
          {data.connectionStatus === 'offline' && (
            <div className="rounded-lg border border-gray-300 bg-gray-100 px-4 py-4 text-center sm:px-6 sm:py-6">
              <div className="text-sm font-semibold text-gray-700">
                Live Update Temporarily Unavailable
              </div>
              <div className="mt-1 text-xs text-gray-600">
                Showing totals from {data.lastUpdated}
              </div>
            </div>
          )}

          {/* Previous Harvest Days */}
          {data.previousDays.length > 0 && (
            <PreviousHarvestDays days={data.previousDays} />
          )}

          {/* Duplicate Warning */}
          <DuplicateWarning warning={data.possibleDuplicates} />

          {/* Supervisor Target Control */}
          <TargetControl
            currentTarget={targetValue}
            onSave={handleSaveTarget}
          />

          {/* Connection Status Footer */}
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 text-center text-xs text-gray-600 sm:px-6 sm:py-6 sm:text-sm">
            <p>Auto-refresh every 30 seconds</p>
            <p className="mt-1">ODK direct monitoring in progress</p>
            <p className="mt-1 font-medium text-gray-700">
              Not yet imported into MFMS Production
            </p>
          </div>
        </div>
      </main>

      {/* Demo State Selector - Development Only */}
      <div className="border-t border-gray-200 bg-white px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3">
            Demo State Selector (Development Only)
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DEMO_STATES) as Array<keyof typeof DEMO_STATES>).map((state) => (
              <button
                key={state}
                onClick={() => handleDemoSelect(state)}
                className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                  selectedDemo === state
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {state}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            This section will be removed in production. It is only for UI testing during development.
          </p>
        </div>
      </div>
    </div>
  )
}
