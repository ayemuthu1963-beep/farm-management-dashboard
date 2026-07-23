# MFMS Harvest Live Counter – Phase 2 Complete Package

## Overview

This is a clean, refactored Phase 2 package containing the approved harvest live counter UI built with React, TypeScript, and Tailwind CSS. All components are properly organized, fully typed, and ready for Phase 3 backend integration.

**Status:** UI-only, development-ready package  
**Route:** `/harvest-live-counter`  
**Next Step:** Phase 3 – Backend API integration, ODK aggregation, deployment

---

## File Structure

```
app/harvest-live-counter/
└─ page.tsx                           (Main page, 121 lines)

components/harvest-live-counter/
├─ harvest-header.tsx                (Header with live status)
├─ today-nuts-card.tsx                (Hero card with large number)
├─ harvest-summary-cards.tsx           (3 summary stat cards)
├─ harvest-status-card.tsx             (Single operational status)
├─ previous-harvest-days.tsx           (Historical data rows)
├─ duplicate-warning.tsx               (Alert for duplicates)
└─ target-control.tsx                  (Supervisor target editor)

lib/
└─ harvest-live-counter-mock.ts       (Mock data + TypeScript types, 136 lines)
```

---

## Component Map

### HarvestLiveCounterPage (Main)
The root component that manages state and renders all child components. Includes a development-only state selector at the bottom to preview different UI states (Live, Near Target, Target Reached, Offline, Empty).

**Key Features:**
- State management for current harvest data
- Target value editing
- Refresh button (mock)
- Demo state selector for testing

**Props:** None (uses mock data internally)

### HarvestHeader
Displays the page title, live/offline status indicator, and last update time.

**Props:**
- `connectionStatus: 'live' | 'offline'` – Connection state
- `lastUpdated: string` – Time of last update (e.g., "10:42:15 AM")
- `onRefresh?: () => void` – Refresh button callback

### TodayNutsCard
Large hero card displaying today's nuts harvested with progress bar and remaining count.

**Props:**
- `todayNuts: number` – Current harvest count
- `targetNuts: number` – Daily target

### HarvestSummaryCards
Three stat cards showing trees, bunches, and ODK submissions.

**Props:**
- `treesHarvested: number`
- `totalBunches: number`
- `submissionCount: number`

### HarvestStatusCard
**Single** operational status card that displays one of:
- "HARVEST IN PROGRESS" (below 98% target)
- "STOP HARVEST / TARGET REACHED" (at or above 100% target)
- "HARVEST HAS NOT STARTED" (empty state)

Does NOT show multiple status cards simultaneously.

**Props:**
- `state: HarvestState` – One of: 'empty' | 'in-progress' | 'near-target' | 'target-reached'
- `todayNuts: number`
- `targetNuts: number`
- `lastUpdated: string`

### PreviousHarvestDays
Table of previous harvest day totals.

**Props:**
- `days: PreviousHarvestDay[]` – Array of previous day records

**Interface:**
```typescript
interface PreviousHarvestDay {
  date: string              // "23-07-2026"
  trees: number
  bunches: number
  nuts: number
}
```

### DuplicateWarning
Yellow alert card displaying possible duplicate tree entries.

**Props:**
- `warning: DuplicateWarning | null` – Warning object or null

**Interface:**
```typescript
interface DuplicateWarning {
  count: number
  treeNumbers: string[]    // Tree numbers as strings (e.g., "845.1")
}
```

### TargetControl
Supervisor panel to view and edit the daily target.

**Props:**
- `currentTarget: number` – Current target value
- `onSave?: (newTarget: number) => void` – Save callback

---

## Mock Data Types & Interfaces

### HarvestLiveCounterData
The complete data structure for the page. All components receive slices of this.

```typescript
interface HarvestLiveCounterData {
  selectedDate: string              // "24-07-2026"
  todayNuts: number                 // Current harvest count
  targetNuts: number                // Daily target
  treesHarvested: number
  totalBunches: number
  submissionCount: number           // ODK submission count
  lastUpdated: string               // "10:42:15 AM"
  lastUpdatedFull: string           // ISO timestamp
  connectionStatus: 'live' | 'offline'
  possibleDuplicates: DuplicateWarning | null
  previousDays: PreviousHarvestDay[]
}
```

### HarvestState
Derived state determining which status card displays.

```typescript
type HarvestState = 'empty' | 'in-progress' | 'near-target' | 'target-reached'

// Logic:
// - empty: submissionCount === 0
// - target-reached: todayNuts >= targetNuts
// - near-target: todayNuts >= targetNuts * 0.98
// - in-progress: all other cases
```

### Mock Data Presets

**HARVEST_LIVE_COUNTER_MOCK** – Default live state (8,450 nuts, 84.5% complete)

**HARVEST_LIVE_COUNTER_NEAR_TARGET** – Approaching target (9,850 nuts, 98.5%)

**HARVEST_LIVE_COUNTER_TARGET_REACHED** – Target exceeded (10,250 nuts, 102.5%)

**HARVEST_LIVE_COUNTER_OFFLINE** – Offline state (cached data from 5 minutes ago)

**HARVEST_LIVE_COUNTER_EMPTY** – No submissions (0 nuts, no data)

---

## Helper Functions

### getHarvestState(data: HarvestLiveCounterData): HarvestState
Determines which UI state to display based on submission count and progress.

### getCompletionPercentage(data): number
Returns percentage completion (0–100+).

### getNutsRemaining(data): number
Returns nuts still needed to reach target (0 if exceeded).

### getNutsExceeded(data): number
Returns nuts over target (0 if not exceeded).

### formatIndianNumber(num: number): string
Formats numbers with Indian locale (e.g., 1,23,456).

---

## Key Design Decisions

### Single Status Card
Only ONE operational status card appears at a time. The `HarvestStatusCard` component handles this logic internally:
- If `state === 'empty'` → shows "Harvest Has Not Started"
- If `state === 'target-reached'` → shows "STOP HARVEST / TARGET REACHED" (red)
- Otherwise → shows "HARVEST IN PROGRESS" (amber)

The red target-reached preview card from Phase 1 design is **removed from the operational page** and only appears in the dev state selector.

### State Selector (Dev Only)
A clearly labeled "Demo State Selector" section appears at the bottom of the page during development. This will be removed in production.

### Responsive Design
All components use Tailwind CSS responsive breakpoints (sm:, lg:) to adapt to mobile, tablet, and desktop viewports.

### Indian Number Formatting
All large numbers use `formatIndianNumber()` to display in Indian locale (1,23,456 instead of 123,456).

---

## How to Run

### Development
```bash
npm install
npm run dev
# Open http://localhost:3000/harvest-live-counter
```

### TypeScript Verification
```bash
npx tsc --noEmit
```

---

## Phase 3 Integration Points (Codex)

Replace mock data functions with real API calls at these locations:

### 1. Initial Data Load (page.tsx, line ~33)
**Replace:**
```typescript
const [data, setData] = useState<HarvestLiveCounterData>(DEMO_STATES[selectedDemo])
```

**With:**
```typescript
const [data, setData] = useState<HarvestLiveCounterData>(null)

useEffect(() => {
  // Fetch from: GET /api/harvest/live?date=2026-07-24
  // Response shape: HarvestLiveCounterData
  fetchHarvestData()
}, [])
```

### 2. Refresh Button (page.tsx, line ~53)
**Replace:**
```typescript
const handleRefresh = () => {
  setData({...data, lastUpdated: new Date().toLocaleTimeString('en-US')})
}
```

**With:**
```typescript
const handleRefresh = async () => {
  const response = await fetch('/api/harvest/live')
  const newData = await response.json()
  setData(newData)
}
```

### 3. Target Control Save (page.tsx, line ~58)
**Replace:**
```typescript
const handleSaveTarget = (newTarget: number) => {
  setTargetValue(newTarget)
  setData({...data, targetNuts: newTarget})
}
```

**With:**
```typescript
const handleSaveTarget = async (newTarget: number) => {
  const response = await fetch('/api/harvest/target', {
    method: 'PUT',
    body: JSON.stringify({date: data.selectedDate, target: newTarget})
  })
  if (response.ok) {
    setTargetValue(newTarget)
    setData({...data, targetNuts: newTarget})
  }
}
```

### 4. 30-Second Auto-Refresh (page.tsx)
**Add:**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    fetchHarvestData()
  }, 30000)
  return () => clearInterval(interval)
}, [])
```

### 5. ODK Integration
ODK Central connection should:
- Poll submissions every 10 seconds
- Aggregate nuts, trees, bunches by date/zone
- Detect duplicate tree numbers
- Store in database
- Expose via `/api/harvest/live` endpoint

---

## Approved Design Preserved

All design elements from Phase 1 approval are maintained:

✅ Large readable numbers (6xl–8xl)  
✅ Amber color for 80%+ completion  
✅ Red alert for target reached  
✅ Progress bar with percentage  
✅ 3 summary stat cards  
✅ Previous harvest day history  
✅ Duplicate warning alert  
✅ Supervisor target control  
✅ Connection status footer  
✅ Responsive mobile/tablet/desktop  
✅ High contrast, sunlight-readable  

---

## Status

✅ Clean component structure  
✅ Full TypeScript types  
✅ Mock data with 5 UI states  
✅ Only one operational status card at a time  
✅ Zero TypeScript compilation errors  
✅ Responsive design verified  
✅ Ready for Phase 3 API integration  

**Do NOT include in production:**
- Demo state selector (remove or hide behind feature flag)
- Mock data (replace with real API calls)
- Console logs or debugging

---

## Next Steps (Phase 3)

1. **Backend Setup**
   - Set up Next.js API routes at `/api/harvest/*`
   - Connect to ODK Central aggregation API
   - Implement database schema for daily targets, submissions
   - Set up 30-second polling from ODK

2. **Environment Configuration**
   - `ODK_CENTRAL_URL` – ODK Central instance URL
   - `ODK_API_TOKEN` – API token for ODK
   - `DATABASE_URL` – Database connection
   - `REFRESH_INTERVAL` – 30-second default

3. **Testing**
   - Mock API responses with real data structure
   - Test all 5 states with API data
   - Verify 30-second refresh interval
   - Test target editing permission control

4. **Deployment**
   - Deploy to Vercel
   - Set environment variables
   - Configure ODK aggregation
   - Enable offline cache (optional PWA)

---

## Questions?

All component interfaces, mock data, and integration points are clearly documented above. Components are individually testable and can be integrated incrementally as backend APIs become available.
