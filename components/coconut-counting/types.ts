/**
 * TypeScript types for Coconut Counting Mobile UI
 * Mobile-only Android portrait design (412×915 px)
 */

export type CountType = 'fixed' | 'manual'
export type GradeType = 'A' | 'B'
export type SyncStatus = 'synced' | 'pending' | 'failed'
export type ScreenName = 'main' | 'history' | 'date'

/**
 * GPS reading with coordinates and accuracy
 */
export interface GPSReading {
  latitude: string
  longitude: string
  accuracy: string
}

/**
 * Single count entry in the session
 */
export interface CountEntry {
  id: string
  sequence: number
  date: string
  time: string
  grade: GradeType
  countType: CountType
  count: number
  gps: GPSReading
  runningTotalA: number
  runningTotalB: number
  runningCombined: number
  syncStatus: SyncStatus
}

/**
 * Last entry information for live session summary
 */
export interface LastEntry {
  grade: GradeType
  count: number
  time: string
}

/**
 * Session totals and status
 */
export interface SessionTotals {
  totalA: number
  totalB: number
  totalCombined: number
  entries: number
  unsynced: number
  gpsActive: boolean
}

/**
 * Daily history aggregated data
 */
export interface DailyHistory {
  date: string
  totalA: number
  totalB: number
  totalCombined: number
  entries: CountEntry[]
}

/**
 * Live session state for main counting screen
 */
export interface LiveSessionState {
  totals: SessionTotals
  lastEntry: LastEntry | null
  entries: CountEntry[]
}

/**
 * Date history state for date selection screen
 */
export interface DateHistoryState {
  selectedDate: string
  totals: SessionTotals
  entries: CountEntry[]
}
