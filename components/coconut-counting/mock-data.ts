/**
 * Mock data for Coconut Counting Mobile UI
 * Replace with live data from app state
 */

import type {
  CountEntry,
  DailyHistory,
  SessionTotals,
  LiveSessionState,
  DateHistoryState,
  LastEntry,
} from './types'

/**
 * Mock session totals - Main screen
 */
export const mockSessionTotals: SessionTotals = {
  totalA: 308,
  totalB: 222,
  totalCombined: 530,
  entries: 4,
  unsynced: 0,
  gpsActive: true,
}

/**
 * Mock last entry - Main screen
 */
export const mockLastEntry: LastEntry = {
  grade: 'A',
  count: 200,
  time: '10:42:15 AM',
}

/**
 * Mock count entries - Today's History
 */
export const mockTodaysEntries: CountEntry[] = [
  {
    id: '1',
    sequence: 1,
    date: '24-07-2026',
    time: '09:15:22 AM',
    grade: 'A',
    countType: 'fixed',
    count: 200,
    gps: { latitude: '11.123456', longitude: '77.987654', accuracy: '± 6 m' },
    runningTotalA: 200,
    runningTotalB: 0,
    runningCombined: 200,
    syncStatus: 'synced',
  },
  {
    id: '2',
    sequence: 2,
    date: '24-07-2026',
    time: '09:42:10 AM',
    grade: 'B',
    countType: 'manual',
    count: 145,
    gps: { latitude: '11.123980', longitude: '77.988210', accuracy: '± 5 m' },
    runningTotalA: 200,
    runningTotalB: 145,
    runningCombined: 345,
    syncStatus: 'synced',
  },
  {
    id: '3',
    sequence: 3,
    date: '24-07-2026',
    time: '10:05:47 AM',
    grade: 'A',
    countType: 'fixed',
    count: 175,
    gps: { latitude: '11.124512', longitude: '77.988765', accuracy: '± 6 m' },
    runningTotalA: 375,
    runningTotalB: 145,
    runningCombined: 520,
    syncStatus: 'synced',
  },
  {
    id: '4',
    sequence: 4,
    date: '24-07-2026',
    time: '10:28:31 AM',
    grade: 'B',
    countType: 'manual',
    count: 200,
    gps: { latitude: '11.125102', longitude: '77.989310', accuracy: '± 4 m' },
    runningTotalA: 375,
    runningTotalB: 345,
    runningCombined: 720,
    syncStatus: 'synced',
  },
]

/**
 * Mock live session state - Main counting screen
 */
export const mockLiveSessionState: LiveSessionState = {
  totals: mockSessionTotals,
  lastEntry: mockLastEntry,
  entries: mockTodaysEntries,
}

/**
 * Mock date history totals - History by Date screen (22-07-2026)
 */
export const mockDateHistoryTotals: SessionTotals = {
  totalA: 600,
  totalB: 720,
  totalCombined: 1320,
  entries: 8,
  unsynced: 0,
  gpsActive: true,
}

/**
 * Mock entries for selected date (22-07-2026)
 */
export const mockSelectedDateEntries: CountEntry[] = [
  {
    id: 'd1',
    sequence: 1,
    date: '22-07-2026',
    time: '08:48:10 AM',
    grade: 'A',
    countType: 'fixed',
    count: 200,
    gps: { latitude: '10.42128', longitude: '76.21905', accuracy: '4.2 m' },
    runningTotalA: 200,
    runningTotalB: 0,
    runningCombined: 200,
    syncStatus: 'synced',
  },
  {
    id: 'd2',
    sequence: 2,
    date: '22-07-2026',
    time: '09:12:33 AM',
    grade: 'B',
    countType: 'manual',
    count: 120,
    gps: { latitude: '10.42185', longitude: '76.21892', accuracy: '3.8 m' },
    runningTotalA: 200,
    runningTotalB: 120,
    runningCombined: 320,
    syncStatus: 'synced',
  },
  {
    id: 'd3',
    sequence: 3,
    date: '22-07-2026',
    time: '09:36:47 AM',
    grade: 'A',
    countType: 'fixed',
    count: 180,
    gps: { latitude: '10.42231', longitude: '76.21918', accuracy: '4.0 m' },
    runningTotalA: 380,
    runningTotalB: 120,
    runningCombined: 500,
    syncStatus: 'synced',
  },
]

/**
 * Mock date history state - History by Date screen
 */
export const mockDateHistoryState: DateHistoryState = {
  selectedDate: '22-07-2026',
  totals: mockDateHistoryTotals,
  entries: mockSelectedDateEntries,
}

/**
 * Mock daily history - All days
 */
export const mockDailyHistories: DailyHistory[] = [
  {
    date: '24-07-2026',
    totalA: 308,
    totalB: 222,
    totalCombined: 530,
    entries: mockTodaysEntries,
  },
  {
    date: '22-07-2026',
    totalA: 600,
    totalB: 720,
    totalCombined: 1320,
    entries: mockSelectedDateEntries,
  },
]
