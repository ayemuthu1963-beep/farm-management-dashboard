// MFMS Harvest Live Counter - Mock Data & Types
// This file contains mock data and TypeScript interfaces
// Replace with real API calls in Phase 3

export type ConnectionStatus = 'live' | 'offline'
export type HarvestState = 'empty' | 'in-progress' | 'near-target' | 'target-reached'

export interface PreviousHarvestDay {
  date: string // "23-07-2026"
  trees: number
  bunches: number
  nuts: number
}

export interface DuplicateWarning {
  count: number
  treeNumbers: string[] // Tree numbers as strings (e.g., "845.1", "1002.1")
}

export interface HarvestLiveCounterData {
  selectedDate: string // "24-07-2026"
  todayNuts: number
  targetNuts: number
  treesHarvested: number
  totalBunches: number
  submissionCount: number
  lastUpdated: string // "10:42:15 AM"
  lastUpdatedFull: string // ISO timestamp for calculations
  connectionStatus: ConnectionStatus
  possibleDuplicates: DuplicateWarning | null
  previousDays: PreviousHarvestDay[]
}

// Mock data reflecting the approved design
export const HARVEST_LIVE_COUNTER_MOCK: HarvestLiveCounterData = {
  selectedDate: '24-07-2026',
  todayNuts: 8450,
  targetNuts: 10000,
  treesHarvested: 325,
  totalBunches: 610,
  submissionCount: 325,
  lastUpdated: '10:42:15 AM',
  lastUpdatedFull: new Date().toISOString(),
  connectionStatus: 'live',
  possibleDuplicates: {
    count: 2,
    treeNumbers: ['845.1', '1002.1'],
  },
  previousDays: [
    {
      date: '23-07-2026',
      trees: 318,
      bunches: 596,
      nuts: 8210,
    },
    {
      date: '22-07-2026',
      trees: 304,
      bunches: 571,
      nuts: 7940,
    },
    {
      date: '21-07-2026',
      trees: 290,
      bunches: 544,
      nuts: 7580,
    },
  ],
}

// Offline state mock (with cached data)
export const HARVEST_LIVE_COUNTER_OFFLINE: HarvestLiveCounterData = {
  ...HARVEST_LIVE_COUNTER_MOCK,
  connectionStatus: 'offline',
  lastUpdated: '10:42:15 AM',
  lastUpdatedFull: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
}

// Empty state mock (no harvest started)
export const HARVEST_LIVE_COUNTER_EMPTY: HarvestLiveCounterData = {
  selectedDate: '24-07-2026',
  todayNuts: 0,
  targetNuts: 10000,
  treesHarvested: 0,
  totalBunches: 0,
  submissionCount: 0,
  lastUpdated: 'No data',
  lastUpdatedFull: new Date().toISOString(),
  connectionStatus: 'live',
  possibleDuplicates: null,
  previousDays: [],
}

// Near target state mock (98.5%)
export const HARVEST_LIVE_COUNTER_NEAR_TARGET: HarvestLiveCounterData = {
  ...HARVEST_LIVE_COUNTER_MOCK,
  todayNuts: 9850,
  treesHarvested: 340,
  totalBunches: 620,
  submissionCount: 340,
}

// Target reached state mock (102.5%)
export const HARVEST_LIVE_COUNTER_TARGET_REACHED: HarvestLiveCounterData = {
  ...HARVEST_LIVE_COUNTER_MOCK,
  todayNuts: 10250,
  treesHarvested: 355,
  totalBunches: 635,
  submissionCount: 355,
}

// Helper functions
export function getHarvestState(data: HarvestLiveCounterData): HarvestState {
  if (data.submissionCount === 0) return 'empty'
  if (data.todayNuts >= data.targetNuts) return 'target-reached'
  if (data.todayNuts >= data.targetNuts * 0.98) return 'near-target'
  return 'in-progress'
}

export function getCompletionPercentage(data: HarvestLiveCounterData): number {
  if (data.targetNuts === 0) return 0
  return Math.round((data.todayNuts / data.targetNuts) * 100)
}

export function getNutsRemaining(data: HarvestLiveCounterData): number {
  return Math.max(0, data.targetNuts - data.todayNuts)
}

export function getNutsExceeded(data: HarvestLiveCounterData): number {
  return Math.max(0, data.todayNuts - data.targetNuts)
}

export function formatIndianNumber(num: number): string {
  return num.toLocaleString('en-IN')
}
