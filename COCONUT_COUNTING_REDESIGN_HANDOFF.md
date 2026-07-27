# Coconut Counting Mobile UI Redesign - Codex Handoff

## Overview

This document describes the redesigned Coconut Counting Android mobile UI as a **static component library** ready for Codex integration with the existing APK logic.

**Branch:** `v0/coconut-counting-mobile-redesign`  
**Build Status:** ✓ Success  
**Route:** `/app/coconut-counting-redesign`

---

## Screen Structure

### Main Screen Layout (Mobile Portrait Only)

The redesigned screen consists of **4 sections**:

#### 1. Header (Green Bar)
- Background: Green gradient (green-600 to green-700)
- Content:
  - Left icon: 🌿 (leaf)
  - Title: "COCONUT COUNTING FORM"
  - Subtitle: "TODAY: 25-07-2026 · ONLINE"
  - Right icon: 🥥 (coconut)
- Component: `CoconutHeader`

#### 2. Counting Tiles (2×2 Grid)
Four tiles for data entry:

| Tile | Grade | Type | Value | Component |
|------|-------|------|-------|-----------|
| A1 | Grade A | Fixed | 200 | `CountTile` |
| B1 | Grade B | Fixed | 200 | `CountTile` |
| A2 | Grade A | Manual | 1-99 pairs | `CountTile` |
| B2 | Grade B | Manual | 1-99 pairs | `CountTile` |

Each tile displays:
- Title (e.g., "GRADE A — 200")
- Colored badge (A1, B1, A2, B2)
- Coconut emoji
- Numeric value
- "SEND" button (➤)

#### 3. Totals Row (3 Tiles)
- Total A: Sum of Grade A entries
- Total B: Sum of Grade B entries
- Total A+B: Combined total
- Component: `TotalTiles`

#### 4. Lower Panel - Counters Section
Component: `LowerPanel`

**Structure:**

**Primary Input (Prominent):**
- Total nuts Harvested (manually entered numeric value)
- Red border (4px), blue input field, large text

**Secondary Read-Only Counters (Calculated Displays):**

Row 1:
- A counter | B counter

Row 2:
- A1 counter | B1 counter

Row 3 (Centered):
- B2 counter

All counters have:
- Red border (4px)
- Blue input background
- Read-only state
- Bold numeric display

#### 5. Action Buttons (3 Buttons)
- HISTORY (🕐) - Teal background
- DATE (📅) - Cyan background
- RESET (⟳) - Orange background
- Component: `ActionButtons`

---

## Components Overview

### 1. `header.tsx` (15 lines)
Renders the green header bar with title, date, and emojis.

**Props:** None (static)  
**Exports:** `CoconutHeader`

### 2. `count-tile.tsx` (39 lines)
Represents a single counting tile (A1, B1, A2, B2).

**Props:**
```typescript
interface CountTileProps {
  title: string          // e.g., "GRADE A — 200"
  grade: 'A' | 'B'      // Color scheme
  count: number         // Current value
  variant: 'fixed' | 'manual'  // Display type
}
```

**Exports:** `CountTile`

### 3. `total-tiles.tsx` (25 lines)
Three summary tiles showing Total A, Total B, Total A+B.

**Props:**
```typescript
interface TotalTilesProps {
  totalA: number
  totalB: number
  totalAB: number
}
```

**Exports:** `TotalTiles`

### 4. `lower-panel.tsx` (100 lines)
The lower counter section with input and read-only displays.

**Props:**
```typescript
interface LowerPanelProps {
  totalNutsHarvested: number  // Editable input
  counterA: number            // Read-only
  counterB: number            // Read-only
  counterA1: number           // Read-only
  counterB1: number           // Read-only
  counterB2: number           // Read-only
}
```

**Exports:** `LowerPanel`

**Visual Distinction:**
- Editable inputs: Red border, blue background
- Read-only displays: Red border, blue background (same styling for mockup)

### 5. `action-buttons.tsx` (19 lines)
Three action buttons (History, Date, Reset).

**Props:** None  
**Exports:** `ActionButtons`

### 6. `page.tsx` (83 lines)
Main page component combining all sections.

**Props:** None  
**Route:** `/coconut-counting-redesign`  
**Export:** Default Next.js page component

---

## Mock Data Structure

The main page uses static mock data:

```typescript
{
  gradeA200: 200,              // Fixed count for Grade A ×200
  gradeB200: 200,              // Fixed count for Grade B ×200
  gradeA99: 45,                // Manual entry for Grade A (1-99)
  gradeB99: 38,                // Manual entry for Grade B (1-99)
  totalA: 3338,                // Sum of all A entries
  totalB: 2000,                // Sum of all B entries
  totalAB: 5338,               // Combined total
  totalNutsHarvested: 5338,    // User input (editable in real app)
  counterA: 3338,              // Calculated counter
  counterB: 2000,              // Calculated counter
  counterA1: 2000,             // Calculated counter
  counterB1: 1000,             // Calculated counter
  counterB2: 338,              // Calculated counter
}
```

---

## Styling & Design

### Mobile-Only Layout
- **Viewport:** Android portrait (412×915 px or 390×844 px)
- **No desktop breakpoints**
- **No horizontal scrolling**
- **Flexbox layout** for responsive stacking

### Color Scheme
| Element | Color | Hex |
|---------|-------|-----|
| Header Background | Green-600 to 700 | #16a34a to #15803d |
| Grade A Tiles | Green-600 | #16a34a |
| Grade B Tiles | Blue-600 | #2563eb |
| Totals - A | Green-300 border | #86efac |
| Totals - B | Blue-300 border | #93c5fd |
| Totals - A+B | Teal-300 border | #67e8f9 |
| Buttons | Teal/Cyan/Orange | #0d9488 / #0891b2 / #ea580c |
| Counter Borders | Red-400 | #f87171 |
| Counter Input | Blue-50 | #eff6ff |

### Typography
- **Title:** Bold, tracking-tight, 2xl
- **Subtitles:** Font-semibold, small/xs
- **Values:** Bold, 2xl-3xl
- **Font:** System default (Tailwind sans)

---

## Codex Integration Checklist

### Phase 1: Current State (Delivered)
- ✓ Static React/TypeScript components
- ✓ Mobile portrait layout
- ✓ Mock data values
- ✓ No business logic
- ✓ No API/database calls
- ✓ No calculations
- ✓ No event handlers
- ✓ No state management

### Phase 2: Codex Implementation
1. **Wire Counting Logic**
   - Connect Grade A/B fixed/manual tiles to counting logic
   - Implement +/- buttons (if needed)
   - Trigger "SEND" to backend

2. **Implement Calculations**
   - Total A = sum of Grade A entries
   - Total B = sum of Grade B entries
   - Total A+B = Total A + Total B
   - All counters (A, B, A1, B1, B2) = calculated from entries

3. **Data Persistence**
   - Connect to APK's existing database
   - Sync with GPS capture
   - Implement export logic

4. **Event Handlers**
   - History button → navigate to history screen
   - Date button → date picker/history by date
   - Reset button → confirmation dialog + reset logic
   - Counter inputs → disable (remain read-only) or enable based on business rules

5. **User Feedback**
   - Add loading states
   - Error handling for sync failures
   - Toast notifications for SEND success
   - Timestamp display for last entry

6. **Future Enhancements**
   - Make "Total nuts Harvested" editable with validation
   - Add keyboard/number pad for Android
   - Optimize for different Android versions
   - Add offline support

---

## Build & Deployment

### Development
```bash
npm run dev
# Opens http://localhost:3000/coconut-counting-redesign
```

### Production Build
```bash
npm run build
# Next.js builds all routes including /coconut-counting-redesign
# ✓ Generating static pages using 3 workers (28/28)
```

### File Structure
```
/app/coconut-counting-redesign/
├── page.tsx                    (Main page component)

/components/coconut-counting-redesign/
├── action-buttons.tsx
├── count-tile.tsx
├── header.tsx
├── lower-panel.tsx
└── total-tiles.tsx
```

---

## Notes for Codex

1. **No Rework Needed**: This is a complete, clean UI package ready for logic integration.

2. **Prop Interfaces**: All components accept TypeScript interfaces. Update as needed when wiring logic.

3. **Colors & Styling**: All use Tailwind CSS utilities. Modify in component files or extend `tailwind.config.ts`.

4. **Mock Data**: Located in `page.tsx`. Replace with state/API data as you implement logic.

5. **Mobile-First**: No desktop layout was intentionally created. Scale for tablets only if required later.

6. **Branch**: All code is on `v0/coconut-counting-mobile-redesign`. Merge when ready.

---

## Questions & Support

For questions about this redesign:
- Check component PropTypes in each file
- Review mock data structure in `page.tsx`
- Test at 412×915 px viewport width
- Build with `npm run build` to verify no TypeScript errors

---

**Status:** Ready for Codex Integration  
**Last Updated:** 2026-07-27  
**Branch:** v0/coconut-counting-mobile-redesign  
**Commit:** fa1805f
