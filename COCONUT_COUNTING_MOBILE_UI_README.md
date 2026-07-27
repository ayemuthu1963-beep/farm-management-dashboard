# Coconut Counting Mobile UI - React/TypeScript Components

## Overview

This is a **mobile-only Android portrait** UI package for the Coconut Counting Form, designed to be imported into an existing React/Vite/Capacitor application.

**Viewport Sizes:**
- Primary: `412 × 915 px`
- Alternate: `390 × 844 px`

**Design Specifications:**
- No desktop layout
- No horizontal scrolling
- No responsive breakpoints
- Android safe-area support
- Touch targets: minimum 44px
- Portrait orientation only

---

## Component Structure

```
components/coconut-counting/
├── types.ts                          # TypeScript interfaces
├── mock-data.ts                      # Mock data for development
├── coconut-counting-header.tsx       # Compact green header
├── count-tile.tsx                    # Count card (fixed/manual)
├── compact-total-tile.tsx            # Compact total card
├── live-session-summary.tsx          # Centre session summary card
├── action-button.tsx                 # Action button (history/date/reset)
├── reset-confirmation-dialog.tsx     # Reset dialog
├── export-confirmation-dialog.tsx    # Export to Excel dialog
├── history-entry-card.tsx            # Individual history entry
├── history-summary-tiles.tsx         # Summary tiles for history screens
├── main-counting-screen.tsx          # Main counting page
├── todays-history-screen.tsx         # Today's history page
└── date-history-screen.tsx           # History by date page
```

---

## TypeScript Types

All types are defined in `types.ts`:

```typescript
export type CountType = 'fixed' | 'manual'
export type GradeType = 'A' | 'B'
export type SyncStatus = 'synced' | 'pending' | 'failed'

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

export interface SessionTotals {
  totalA: number
  totalB: number
  totalCombined: number
  entries: number
  unsynced: number
  gpsActive: boolean
}
```

---

## Component Usage

### Main Counting Screen

```tsx
import { MainCountingScreen } from '@/components/coconut-counting/main-counting-screen'

export function App() {
  return (
    <MainCountingScreen
      onHistoryClick={() => console.log('Open history')}
      onDateClick={() => console.log('Open date')}
      onResetClick={() => console.log('Reset')}
    />
  )
}
```

### Today's History Screen

```tsx
import { TodaysHistoryScreen } from '@/components/coconut-counting/todays-history-screen'

<TodaysHistoryScreen
  onBack={() => setScreen('main')}
  onExport={(date) => console.log(`Export ${date}`)}
/>
```

### Date History Screen

```tsx
import { DateHistoryScreen } from '@/components/coconut-counting/date-history-screen'

<DateHistoryScreen
  onBack={() => setScreen('main')}
  onExport={(date) => console.log(`Export ${date}`)}
/>
```

---

## Mock Data

All mock data is in `mock-data.ts`. Replace with live data:

```tsx
import { mockLiveSessionState, mockTodaysEntries } from '@/components/coconut-counting/mock-data'

// Use in your state management
const [sessionState, setSessionState] = useState(mockLiveSessionState)
```

---

## Tailwind CSS Requirements

The UI uses Tailwind CSS with these utilities. Ensure your Tailwind config includes:

```javascript
// tailwind.config.ts
export default {
  content: [
    './components/coconut-counting/**/*.tsx',
  ],
  theme: {
    extend: {
      colors: {
        // Using default Tailwind colors
      },
    },
  },
}
```

### Key Tailwind Classes Used:
- Spacing: `px-3`, `py-2`, `gap-1.5`, `gap-2`
- Colors: `bg-green-600`, `bg-blue-600`, `bg-teal-500`, `bg-orange-600`
- Layout: `flex`, `grid`, `fixed`, `overflow-y-auto`
- Typography: `font-bold`, `text-sm`, `text-lg`, `text-4xl`

---

## Screen Layout Details

### Main Counting Screen (412×915px)
1. **Header** (~80px) - Leaf icon, title, coconut icon, date
2. **2×2 Count Tiles** (~280px) - Grade A/B fixed and manual
3. **Compact Totals** (~60px) - Total A, B, A+B
4. **Live Session Summary** (~200px) - Centre card with session info
5. **Action Buttons** (~50px) - History, Date, Reset
6. **Total:** Fills exactly 915px, no scrolling

### Today's History Screen
1. **Header** (~80px)
2. **Title** (~40px)
3. **GPS Banner** (~50px)
4. **Summary Tiles** (~60px)
5. **Export Button** (~50px)
6. **Entry Cards** (scrollable) - Multiple cards with full entry data
7. **Back Button** (~50px)

### Date History Screen
1. **Header** (~80px)
2. **Title** (~40px)
3. **Date Selector** (~90px) - PREV/TODAY/NEXT buttons
4. **Show Calendar Toggle** (~40px)
5. **Calendar** (optional, ~200px) - 7×5 grid
6. **Summary Tiles** (~60px)
7. **Export Button** (~50px)
8. **Entry Cards** (scrollable)
9. **Back Button** (~50px)

---

## Dialogs

### Reset Confirmation Dialog
```tsx
<ResetConfirmationDialog
  isOpen={showReset}
  onCancel={() => setShowReset(false)}
  onConfirm={() => handleReset()}
/>
```

Message:
```
RESET CURRENT COUNT?

Current Grade A, Grade B and A+B totals will return to zero.
Today's previous entries and past-day history will remain saved.
```

### Export Confirmation Dialog
```tsx
<ExportConfirmationDialog
  isOpen={showExport}
  date="24-07-2026"
  entryCount={10}
  onCancel={() => setShowExport(false)}
  onConfirm={() => handleExport()}
/>
```

Shows:
- Selected date
- Filename (`Coconut_Counting_24_07_2026.xlsx`)
- Entry count
- Cancel/Export buttons

---

## CSS Notes

- **No desktop layout** - All screens are 412px fixed width
- **No media queries** - Mobile-only, no responsive breakpoints
- **No horizontal scrolling** - All content fits vertically or scrolls vertically only
- **Safe area support** - Consider `padding-top: env(safe-area-inset-top)` for notch devices
- **Touch targets** - All buttons are minimum 44px height
- **Color scheme** - Green (A), Blue (B), Teal (A+B), Orange (entries)

---

## Integration Points

These callbacks receive data from the app's business logic:

### Main Screen Props
```typescript
interface MainCountingScreenProps {
  onHistoryClick?: () => void      // Navigate to history
  onDateClick?: () => void         // Navigate to date selection
  onResetClick?: () => void        // Handle reset confirmation
}
```

### History Screens Props
```typescript
interface TodaysHistoryScreenProps {
  onBack?: () => void              // Navigate back to main
  onExport?: (date: string) => void // Handle export
}
```

---

## What to Replace with Live Data

1. **mock-data.ts** values:
   - `mockSessionTotals` → Live session state from app
   - `mockLastEntry` → Last entry from database
   - `mockTodaysEntries` → Today's entries from database
   - `mockSelectedDateEntries` → Selected date entries from database

2. **Component callbacks:**
   - `onSend()` in CountTile → Log entry to database
   - `onClick handlers` → Navigate screens
   - `onReset()` → Clear session totals
   - `onExport()` → Generate and export Excel file

3. **Button click handlers** are currently mock. Wire to:
   - Previous/Next/Today date selectors
   - Calendar date selection
   - Export functionality

---

## Accessibility

- Semantic HTML structure
- Clear button labels
- High contrast colors
- Touch-friendly sizing (44px minimum)
- ARIA labels recommended for screen readers

---

## Browser/Device Support

- **Minimum Android:** Android 8+
- **Target:** Capacitor/React Native environment
- **Layout:** Fixed 412×915px (or 390×844px)
- **Scrolling:** Vertical scroll only, no horizontal scroll

---

## Dependencies

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "tailwindcss": "^3.0.0",
    "@tailwindcss/forms": "^0.5.0"
  }
}
```

---

## File Sizes

All TypeScript files are optimized for mobile. No external dependencies beyond React and Tailwind CSS.

---

## Next Steps for Codex Integration

1. Import MainCountingScreen into your app's main screen
2. Implement screen navigation (main → history → date)
3. Replace mock data with live database queries
4. Wire up button callbacks to business logic
5. Implement reset, export, and GPS functionality
6. Test at 412×915px viewport
7. Deploy to Android APK

---

**Design Status:** ✅ Approved  
**Component Status:** ✅ Complete  
**Ready for Integration:** ✅ Yes
