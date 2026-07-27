# MFMS Harvest Live Counter – Component Map & Architecture

## Component Hierarchy

```
HarvestLiveCounterPage (Main)
├─ HarvestHeader
│  └─ Props: connectionStatus, lastUpdated, onRefresh
├─ TodayNutsCard
│  └─ Props: todayNuts, targetNuts
├─ HarvestSummaryCards
│  └─ Props: treesHarvested, totalBunches, submissionCount
├─ HarvestStatusCard (SINGLE, only one visible at a time)
│  └─ Props: state, todayNuts, targetNuts, lastUpdated
├─ PreviousHarvestDays
│  └─ Props: days
├─ DuplicateWarning
│  └─ Props: warning
├─ TargetControl
│  └─ Props: currentTarget, onSave
└─ [Demo State Selector] (Dev only, bottom of page)
```

---

## Component Details

### 1. HarvestHeader
**File:** `components/harvest-live-counter/harvest-header.tsx` (49 lines)

**Purpose:** Displays page title, connection status, and refresh button.

**Props:**
```typescript
interface HarvestHeaderProps {
  connectionStatus: ConnectionStatus    // 'live' | 'offline'
  lastUpdated: string                   // "10:42:15 AM"
  onRefresh?: () => void
}
```

**UI Elements:**
- MFMS logo (Leaf icon)
- Title: "MFMS Harvest Live Counter"
- Live indicator dot (animated green or static gray)
- Last updated time
- Refresh button

**Responsive:** Yes (hides "Refresh" label on mobile, shows icon only)

---

### 2. TodayNutsCard
**File:** `components/harvest-live-counter/today-nuts-card.tsx` (66 lines)

**Purpose:** Hero card with large number display, progress bar, target, and remaining count.

**Props:**
```typescript
interface TodayNutsCardProps {
  todayNuts: number
  targetNuts: number
}
```

**Calculated Values:**
- `completion%` = (todayNuts / targetNuts) × 100
- `nutsRemaining` = targetNuts - todayNuts (or negative if exceeded)

**UI Elements:**
- Label: "TODAY'S NUTS"
- Large number: 6xl–8xl font, amber/red text
- Target and percentage
- Progress bar (amber gradient)
- Remaining count

**Styling:** Amber border and background (border-2 border-amber-200 bg-amber-50)

**Responsive:** Yes (text scales from 6xl mobile to 8xl desktop)

---

### 3. HarvestSummaryCards
**File:** `components/harvest-live-counter/harvest-summary-cards.tsx` (49 lines)

**Purpose:** Three stat cards for key metrics.

**Props:**
```typescript
interface HarvestSummaryCardsProps {
  treesHarvested: number
  totalBunches: number
  submissionCount: number
}
```

**Layout:** 
- Mobile: 1 column
- Tablet/Desktop: 3 columns (grid-cols-3)

**Cards:**
1. Trees Harvested
2. Total Bunches
3. ODK Submissions

**UI:** Gray border, white background, large numbers

---

### 4. HarvestStatusCard
**File:** `components/harvest-live-counter/harvest-status-card.tsx` (67 lines)

**Purpose:** SINGLE operational status card (only one visible at a time).

**Props:**
```typescript
interface HarvestStatusCardProps {
  state: HarvestState  // 'empty' | 'in-progress' | 'near-target' | 'target-reached'
  todayNuts: number
  targetNuts: number
  lastUpdated: string
}
```

**State Behavior:**

| State | Display | Color | Message |
|-------|---------|-------|---------|
| `in-progress` | Show | Amber | "HARVEST IN PROGRESS" |
| `near-target` | Show | Amber | "HARVEST IN PROGRESS" |
| `target-reached` | Show | Red | "STOP HARVEST\nTARGET REACHED\nTarget exceeded by X nuts" |
| `empty` | Show | Gray | "HARVEST HAS NOT STARTED" |

**Key Point:** Only ONE status card renders. Logic is internal to component.

---

### 5. PreviousHarvestDays
**File:** `components/harvest-live-counter/previous-harvest-days.tsx` (38 lines)

**Purpose:** Display historical harvest data as rows.

**Props:**
```typescript
interface PreviousHarvestDaysProps {
  days: PreviousHarvestDay[]
}

interface PreviousHarvestDay {
  date: string         // "23-07-2026"
  trees: number
  bunches: number
  nuts: number
}
```

**Behavior:**
- Returns `null` if `days.length === 0`
- Displays title: "PREVIOUS HARVEST DAYS"
- Each day as a row with formatted numbers

**UI:** White cards with gray border

---

### 6. DuplicateWarning
**File:** `components/harvest-live-counter/duplicate-warning.tsx` (34 lines)

**Purpose:** Alert card for potential duplicate tree entries.

**Props:**
```typescript
interface DuplicateWarningProps {
  warning: DuplicateWarning | null
}

interface DuplicateWarning {
  count: number
  treeNumbers: string[]  // e.g., ["845.1", "1002.1"]
}
```

**Behavior:**
- Returns `null` if `warning === null` or `warning.count === 0`
- Displays alert icon, title, tree numbers, and "View Entries" button

**UI:** Yellow background (bg-yellow-50), left border accent (border-l-4)

---

### 7. TargetControl
**File:** `components/harvest-live-counter/target-control.tsx` (87 lines)

**Purpose:** Supervisor panel to view and edit daily target.

**Props:**
```typescript
interface TargetControlProps {
  currentTarget: number
  onSave?: (newTarget: number) => void
}
```

**Features:**
- Display current target
- Toggle edit mode
- Input validation (must be positive number)
- Save/Cancel buttons
- Lock icon indicating supervisor-only access

**UI:** White card with gray border

---

## Data Flow

```
HarvestLiveCounterPage
├─ useState(data: HarvestLiveCounterData)
├─ useState(targetValue: number)
├─ handleRefresh() → updates data
├─ handleSaveTarget(newTarget) → updates targetValue and data
└─ Passes slices to children:
   ├─ HarvestHeader ← {connectionStatus, lastUpdated, onRefresh}
   ├─ TodayNutsCard ← {todayNuts, targetNuts}
   ├─ HarvestSummaryCards ← {treesHarvested, totalBunches, submissionCount}
   ├─ HarvestStatusCard ← {state, todayNuts, targetNuts, lastUpdated}
   ├─ PreviousHarvestDays ← {days}
   ├─ DuplicateWarning ← {warning}
   └─ TargetControl ← {currentTarget, onSave}
```

---

## Mock Data Structure

**File:** `lib/harvest-live-counter-mock.ts` (136 lines)

### Types Exported

```typescript
type ConnectionStatus = 'live' | 'offline'
type HarvestState = 'empty' | 'in-progress' | 'near-target' | 'target-reached'

interface PreviousHarvestDay
interface DuplicateWarning
interface HarvestLiveCounterData
```

### Mock Presets

1. **HARVEST_LIVE_COUNTER_MOCK** – Base live state (8,450 nuts, 84.5%)
2. **HARVEST_LIVE_COUNTER_NEAR_TARGET** – Near target (9,850 nuts, 98.5%)
3. **HARVEST_LIVE_COUNTER_TARGET_REACHED** – Exceeded (10,250 nuts, 102.5%)
4. **HARVEST_LIVE_COUNTER_OFFLINE** – Cached data (5 min old)
5. **HARVEST_LIVE_COUNTER_EMPTY** – No submissions (0 nuts)

### Helper Functions

```typescript
getHarvestState(data) → HarvestState       // Determines which UI state
getCompletionPercentage(data) → number     // Returns 0–100+
getNutsRemaining(data) → number            // Returns nuts needed
getNutsExceeded(data) → number             // Returns nuts over target
formatIndianNumber(num) → string           // Formats as 1,23,456
```

---

## Styling System

### Colors Used

- **Amber:** Progress indicator (80%+), in-progress status
- **Red:** Target-reached status, stop harvest alert
- **Green:** Live indicator dot
- **Gray:** Offline status, secondary elements, backgrounds

### Typography

- **Page Title:** 2xl bold (mobile) → responsive up
- **Hero Number:** 6xl bold (mobile) → 8xl (desktop)
- **Card Titles:** sm uppercase, tracking-wide
- **Body Text:** sm–base, gray-600 to gray-900

### Layout

- **Max Width:** 4xl container (56rem)
- **Spacing:** 6–8 base (responsive with sm: prefix)
- **Gap:** 4–8 base
- **Border Radius:** lg (rounded-lg)

---

## Responsive Breakpoints

All components use Tailwind sm: prefix for tablet and desktop:

- **Mobile:** < 640px (default classes)
- **Tablet/Desktop:** ≥ 640px (sm: classes)

Examples:
```
px-4 sm:px-6       // Padding
text-lg sm:text-2xl // Font size
py-6 sm:py-8       // Vertical padding
grid-cols-1 sm:grid-cols-3  // Grid layout
```

---

## State Management

### Page-Level State (page.tsx)

```typescript
const [selectedDemo, setSelectedDemo] = useState('Live')
const [data, setData] = useState(HarvestLiveCounterData)
const [targetValue, setTargetValue] = useState(number)
```

### Component-Level State (TargetControl only)

```typescript
const [isEditing, setIsEditing] = useState(false)
const [newTarget, setNewTarget] = useState(string)
```

---

## Development vs. Production

### Development (includes)
- Demo state selector at bottom
- All 5 UI states accessible via buttons
- Mock data hardcoded
- Debugging-friendly layout

### Production (remove)
- Demo state selector (or hide behind feature flag)
- Replace mock data with API calls
- Clean up console.log statements
- Environment-specific configuration

---

## Testing Checklist

### Component Rendering
- [ ] HarvestHeader displays title and status
- [ ] TodayNutsCard shows large number, progress bar, remaining
- [ ] HarvestSummaryCards displays 3 cards
- [ ] HarvestStatusCard shows correct status for each state
- [ ] PreviousHarvestDays displays historical data
- [ ] DuplicateWarning shows/hides correctly
- [ ] TargetControl allows editing

### State Transitions
- [ ] Clicking demo buttons changes all data
- [ ] Refresh button updates timestamp
- [ ] Target edit mode toggle works
- [ ] Save target persists value

### Responsive Design
- [ ] Mobile (390px) stacks correctly
- [ ] Tablet (768px) wraps appropriately
- [ ] Desktop (1200px) displays all sections
- [ ] No horizontal overflow on mobile

### Data Formatting
- [ ] Indian number format applied (1,23,456)
- [ ] Percentages display correctly
- [ ] Dates formatted as DD-MM-YYYY
- [ ] Times formatted as HH:MM:SS AM/PM

---

## Integration Readiness

All components are ready for Phase 3 integration:

✅ Props are well-defined and typed  
✅ No external dependencies beyond React/Tailwind  
✅ Mock data is easily replaceable with API calls  
✅ State flow is unidirectional (parent → children)  
✅ Components are individually testable  
✅ No hardcoded paths or API endpoints  

Replace mock data with `useEffect` + `fetch` calls and the UI is ready for production.
