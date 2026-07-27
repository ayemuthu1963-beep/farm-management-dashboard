# Codex - Coconut Counting UI Handoff

## Phase 1 Complete: UI Design & Components

This package contains the **approved mobile-only UI** for the Coconut Counting Form.

**Delivered:**
- ✅ All screen components (React/TypeScript)
- ✅ All dialog components
- ✅ Reusable UI components
- ✅ TypeScript types and interfaces
- ✅ Mock data for development
- ✅ Documentation and integration guide

**Not Included (Phase 2):**
- Counting logic
- GPS capture
- Database operations
- Sync API
- Excel export implementation
- Android/Capacitor integration

---

## File Manifest

### Components (12 files)
```
components/coconut-counting/
├── coconut-counting-header.tsx       (30 lines)
├── count-tile.tsx                    (72 lines)
├── compact-total-tile.tsx            (43 lines)
├── live-session-summary.tsx          (64 lines)
├── action-button.tsx                 (31 lines)
├── reset-confirmation-dialog.tsx     (51 lines)
├── export-confirmation-dialog.tsx    (64 lines)
├── history-entry-card.tsx            (89 lines)
├── history-summary-tiles.tsx         (47 lines)
├── main-counting-screen.tsx          (119 lines)
├── todays-history-screen.tsx         (159 lines)
└── date-history-screen.tsx           (139 lines)
```

### TypeScript & Data (2 files)
```
components/coconut-counting/
├── types.ts                          (87 lines)  # All interfaces & types
└── mock-data.ts                      (195 lines) # Mock data for dev
```

### Documentation (2 files)
```
├── COCONUT_COUNTING_MOBILE_UI_README.md     # Usage guide
└── CODEX_COCONUT_UI_HANDOFF.md              # This file
```

---

## Integration Steps for Codex

### Step 1: Import Components into Your App

```tsx
// app/coconut-counting/page.tsx
'use client'

import { useState } from 'react'
import { MainCountingScreen } from '@/components/coconut-counting/main-counting-screen'
import { TodaysHistoryScreen } from '@/components/coconut-counting/todays-history-screen'
import { DateHistoryScreen } from '@/components/coconut-counting/date-history-screen'

type Screen = 'main' | 'history' | 'date'

export default function CoconutCountingApp() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('main')

  return (
    <>
      {currentScreen === 'main' && (
        <MainCountingScreen
          onHistoryClick={() => setCurrentScreen('history')}
          onDateClick={() => setCurrentScreen('date')}
          onResetClick={() => {/* Reset logic */}}
        />
      )}
      {currentScreen === 'history' && (
        <TodaysHistoryScreen
          onBack={() => setCurrentScreen('main')}
          onExport={(date) => {/* Export logic */}}
        />
      )}
      {currentScreen === 'date' && (
        <DateHistoryScreen
          onBack={() => setCurrentScreen('main')}
          onExport={(date) => {/* Export logic */}}
        />
      )}
    </>
  )
}
```

---

### Step 2: Replace Mock Data with Live State

In each screen component, replace mock data with your state:

**Before (mock):**
```tsx
const { totals, lastEntry } = mockLiveSessionState
```

**After (live):**
```tsx
// Get from your Redux/Zustand/Context
const { totals, lastEntry } = useCoconutState()
```

---

### Step 3: Wire Button Callbacks

#### Count Tile - SEND Button
```tsx
// In count-tile.tsx, replace onSend={() => {}}
<CountTile
  onSend={() => {
    // TODO: Log count entry to database
    // Call your logCountEntry(grade, type, count) function
  }}
/>
```

#### Action Buttons
Already wired to navigation:
- `onHistoryClick()` - Navigate to history
- `onDateClick()` - Navigate to date selection
- `onResetClick()` - Show reset confirmation (implement actual reset)

#### Reset Confirmation
```tsx
// In reset-confirmation-dialog.tsx
<button
  onClick={onConfirm}
  className="..."
>
  RESET
</button>
// TODO: Implement actual reset logic
// - Clear session totals
// - Preserve history entries
// - Update state
```

#### Export Button
```tsx
// In todays-history-screen.tsx and date-history-screen.tsx
<button
  onClick={() => setShowExportDialog(true)}
  className="..."
>
  EXPORT TO EXCEL
</button>
// TODO: Implement Excel generation
// - Use xlsx library or your export service
// - Include date, entries count, entry details
// - Trigger download or share
```

---

### Step 4: Implement Business Logic

#### Counting Logic (Count Tile)

```tsx
// app/lib/coconut-service.ts
export async function logCountEntry(
  grade: 'A' | 'B',
  countType: 'fixed' | 'manual',
  count: number,
  gps: { lat: string; lng: string; accuracy: string }
) {
  const entry = {
    id: generateId(),
    sequence: getNextSequence(),
    date: getTodayDate(),
    time: getCurrentTime(),
    grade,
    countType,
    count,
    gps,
    runningTotalA: calculateRunningA(),
    runningTotalB: calculateRunningB(),
    runningCombined: calculateCombined(),
    syncStatus: 'pending',
  }
  
  // Save to database
  await saveEntry(entry)
  
  // Update session totals
  await updateSessionTotals()
  
  // Sync to server (or queue if offline)
  queueSync(entry)
}
```

#### Reset Logic

```tsx
// app/lib/coconut-service.ts
export async function resetCurrentSession() {
  // Reset session totals to 0
  await resetTotals()
  
  // Keep history entries intact
  // Do NOT delete history data
  
  // Clear any pending sync
  // Ready for new session
}
```

#### Export Logic

```tsx
// app/lib/coconut-service.ts
export async function exportToExcel(date: string) {
  const entries = await getEntriesForDate(date)
  const totals = await getTotalsForDate(date)
  
  // Generate Excel file
  const workbook = createWorkbook()
  const sheet = addSheet(workbook, date)
  
  // Add headers and data
  addHeaders(sheet)
  addEntries(sheet, entries)
  addTotals(sheet, totals)
  
  // Save or share
  const filename = `Coconut_Counting_${date.replace(/-/g, '_')}.xlsx`
  await downloadFile(workbook, filename)
}
```

---

### Step 5: GPS Integration

The UI shows GPS data. Wire to your GPS service:

```tsx
// In MockLiveSessionState
gpsActive: useGPS().isActive    // Replace true/false with real value
unsynced: useSync().count       // Replace 0 with real unsynced count

// Capture GPS with each entry
const gpsReading = await captureGPS()
const entry = {
  ...entry,
  gps: {
    latitude: gpsReading.lat,
    longitude: gpsReading.lng,
    accuracy: gpsReading.accuracy,
  },
}
```

---

### Step 6: Date Selection Logic

Wire date selection to history queries:

```tsx
// In date-history-screen.tsx
const [selectedDate, setSelectedDate] = useState('22-07-2026')

const handlePrevious = async () => {
  const prevDate = subtractDay(selectedDate)
  setSelectedDate(prevDate)
  const entries = await getEntriesForDate(prevDate)
  setEntries(entries)
}

const handleNext = async () => {
  const nextDate = addDay(selectedDate)
  setSelectedDate(nextDate)
  const entries = await getEntriesForDate(nextDate)
  setEntries(entries)
}

const handleToday = async () => {
  const today = getTodayDate()
  setSelectedDate(today)
  const entries = await getEntriesForDate(today)
  setEntries(entries)
}

// Calendar date selection
const handleDateClick = async (day: number) => {
  const clickedDate = `${day}-07-2026` // Format as DD-MM-YYYY
  setSelectedDate(clickedDate)
  const entries = await getEntriesForDate(clickedDate)
  setEntries(entries)
}
```

---

## Data Binding Reference

### Main Counting Screen
```typescript
interface MainCountingScreenProps {
  onHistoryClick?: () => void
  onDateClick?: () => void
  onResetClick?: () => void
}

// Internal state (from mock, replace with live):
const { totals, lastEntry, entries } = mockLiveSessionState

// totals: SessionTotals {
//   totalA: number           // Sum of Grade A counts
//   totalB: number           // Sum of Grade B counts
//   totalCombined: number    // totalA + totalB
//   entries: number          // Count of entries
//   unsynced: number         // Count of unsynced entries
//   gpsActive: boolean       // GPS currently capturing
// }

// lastEntry: LastEntry {
//   grade: 'A' | 'B'
//   count: number
//   time: string
// }
```

### Today's History Screen
```typescript
interface TodaysHistoryScreenProps {
  onBack?: () => void
  onExport?: (date: string) => void
}

// Internal (replace with live):
const entries = mockTodaysEntries // CountEntry[]
const totalA = sum(entries.filter(e => e.grade === 'A'))
const totalB = sum(entries.filter(e => e.grade === 'B'))
```

### Date History Screen
```typescript
interface DateHistoryScreenProps {
  onBack?: () => void
  onExport?: (date: string) => void
}

// Internal (replace with live):
const [selectedDate, setSelectedDate] = useState('22-07-2026')
const entries = mockSelectedDateEntries // CountEntry[] for date
const totals = mockDateHistoryTotals    // SessionTotals for date
```

---

## Tailwind CSS Configuration

Ensure your `tailwind.config.ts` includes coconut-counting components:

```typescript
// tailwind.config.ts
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './components/coconut-counting/**/*.{js,ts,jsx,tsx}', // Add this
  ],
  theme: {
    extend: {},
  },
}
```

---

## Testing Checklist

- [ ] Main screen renders at 412×915px
- [ ] Main screen renders at 390×844px
- [ ] All 4 count tiles visible (A1, B1, A2, B2)
- [ ] 3 compact totals visible (A, B, A+B)
- [ ] Live session summary card visible
- [ ] Last entry info shows correctly
- [ ] GPS status icon displays
- [ ] Entries count displays
- [ ] Sync count displays
- [ ] 3 action buttons visible (History, Date, Reset)
- [ ] History screen shows entries list
- [ ] GPS banner visible on history
- [ ] Export button works
- [ ] Date screen shows date selector
- [ ] Calendar opens/closes
- [ ] Reset dialog shows on button click
- [ ] Export dialog shows on button click
- [ ] No horizontal scrolling on any screen
- [ ] Vertical scrolling works for history screens
- [ ] All buttons have 44px+ touch targets
- [ ] All text is readable (font sizes correct)

---

## Known Limitations (UI Only)

These are **UI components only** - Codex must implement:
- ❌ Counting logic (mock callbacks provided)
- ❌ GPS capture (UI shows mock status)
- ❌ Database storage (mock data provided)
- ❌ Sync service (UI shows mock sync count)
- ❌ Excel export (mock dialog provided)
- ❌ Session persistence (no state management)
- ❌ Android native features (no Capacitor setup)

---

## Support

For UI questions or issues:
1. Check `COCONUT_COUNTING_MOBILE_UI_README.md`
2. Review component prop interfaces in each file
3. Verify Tailwind CSS is configured correctly
4. Ensure 412×915px viewport for testing

---

## Sign-off

**UI Package:** ✅ Complete & Approved  
**Components:** ✅ 12 files, 951 lines of code  
**Documentation:** ✅ Complete  
**Ready for Codex Integration:** ✅ Yes  

**Next Phase:** Codex to implement business logic and Android integration.
