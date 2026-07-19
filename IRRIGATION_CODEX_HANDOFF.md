# Irrigation Management Dashboard – Codex Integration Handoff

**Status**: Frontend redesign complete and ready for Codex integration with the existing MFMS API.

**Date**: July 19, 2026
**Route**: `/irrigation-management`
**Type**: Frontend-only redesign with mock data (no backend code included)

---

## Executive Summary

The Irrigation Management module has been redesigned as a hybrid map-focused dashboard that combines Concept B's geographic interface with Concept A's operational zone visibility. All six irrigation zones (P1E, P1W, P2E, P2W, JF, NM) are fully supported with independent Nutmeg (NM) status.

The frontend is production-ready with comprehensive mock data and requires backend API integration to replace mock functions and enable real data flow.

---

## Page Structure

### Layout (Desktop View)

```
Header (MFMS branding + Home/Logout navigation)
─────────────────────────────────────────────────

Page Title: "IRRIGATION MANAGEMENT"
Subtitle: "Water distribution by irrigation zone"

DATE & PERIOD CONTROLS
├─ Period buttons: Today | Yesterday | Last 7 Days | Current Cycle | Custom
├─ Refresh button (mock)
└─ Export button (mock)

SUMMARY CARDS (5 cards in a row)
├─ Total Runtime (20h 45m)
├─ Total Water Pumped (10,37,500 L)
├─ Zones Irrigated (6/6)
├─ Zones Not Irrigated (0/6)
└─ Average Water per Tree (1,804 L)

ZONE STATUS (6 compact cards, always visible)
├─ P1E: Irrigated | Runtime: 3h 30m | Water: 1,75,000 L | Per Tree: 1,400 L
├─ P1W: Irrigated | Runtime: 3h 20m | Water: 1,66,667 L | Per Tree: 1,515 L
├─ P2E: Irrigated | Runtime: 3h 40m | Water: 1,83,333 L | Per Tree: 1,359 L
├─ P2W: Irrigated | Runtime: 3h 15m | Water: 1,62,500 L | Per Tree: 1,269 L
├─ JF:  Irrigated | Runtime: 4h     | Water: 2,00,000 L | Per Tree: 4,762 L
└─ NM:  Irrigated | Runtime: 3h     | Water: 1,50,000 L | Per Tree: 4,286 L

MAP AND ZONE DETAILS (2/3 + 1/3 layout)
├─ Left (2/3): SVG Farm Map
│  ├─ 5 physical plots (P1E, P1W, P2E, P2W, JF)
│  ├─ Nutmeg overlay (hatched pattern) on P1E and P2W
│  ├─ Color-coded status (green=irrigated, gray=no record, amber=partial)
│  └─ Legend at bottom
│
└─ Right (1/3): Selected Zone Detail Panel
   ├─ Zone name and abbreviation
   ├─ Overlap info (if Nutmeg: "Operational overlay spanning P1E, P2W")
   ├─ Crop type and tree count
   ├─ Motor and valve info
   ├─ Runtime, total water, water per tree
   ├─ Last irrigation date and time
   └─ Status badge

OPERATIONAL ALERTS (if any zones missing records)
├─ Gray alert: Zone name – No irrigation record for selected date
└─ Amber alert: Zone name – Partial irrigation record (X records)

THREE CHART PANELS
├─ Chart 1: Runtime & Water Pumped by Zone (dual-axis bar chart)
│  ├─ Left Y-axis: Runtime (hours)
│  ├─ Right Y-axis: Water (thousands litres)
│  └─ All 6 zones included
│
├─ Chart 2: Water Supplied per Tree by Crop (bar chart)
│  ├─ Y-axis: Litres per Tree
│  ├─ Crop rates note: Coconut 100 L/tree, Jackfruit 60 L/tree, Nutmeg 80 L/tree
│  └─ All 6 zones included
│
└─ Chart 3: Daily Irrigation Trend (dual-axis line chart, 10 days)
   ├─ Left Y-axis: Total Water Pumped (thousands litres)
   ├─ Right Y-axis: Total Runtime (hours)
   └─ X-axis: Dates (last 10 days)

DETAILED RECORDS TABLE
├─ Zone filter dropdown (All Zones + all 6 zones)
├─ Sortable columns: Zone, Start Time, End Time, Runtime, Water, Per Tree
├─ Alternating row colors
├─ Record count display
└─ All records for the selected date

Footer: Sidebar navigation remains visible
```

---

## Component Files

### Created/Modified Files

```
lib/irrigation-mock-data.ts
├─ ZONE_CONFIG: All 6 zone definitions (P1E, P1W, P2E, P2W, JF, NM)
├─ IRRIGATION_RECORDS: Mock irrigation events (date, zone, runtime, water)
├─ Helper functions: getZoneDetails(), getAllZoneDetails(), formatWaterLitres(), formatRuntimeMinutes()
└─ TypeScript types: ZoneId, IrrigationRecord, ZoneDetail

app/irrigation-management/page.tsx
├─ Main page component (94 lines)
├─ State management: selectedZoneId, selectedDate
├─ Renders all child components
└─ Generates alerts for missing/partial zones

components/irrigation/
├─ irrigation-period-selector.tsx
│  ├─ Period buttons: Today, Yesterday, Last 7 Days, Current Cycle, Custom
│  ├─ Date range picker (hidden by default)
│  ├─ Refresh button (mock)
│  └─ Export button (mock)
│
├─ irrigation-summary-cards.tsx
│  ├─ 5 stat cards
│  ├─ Calculations from mock data
│  └─ Indian number formatting
│
├─ zone-status-cards.tsx
│  ├─ 6 compact zone cards
│  ├─ Click to select zone
│  ├─ Displays runtime, water, per-tree values
│  └─ Status badge (Irrigated/No Record/Partial)
│
├─ irrigation-map-with-details.tsx
│  ├─ SVG-based farm map
│  ├─ 5 physical zone shapes (clickable)
│  ├─ Nutmeg overlay (2 hatched patches on P1E and P2W)
│  ├─ Status color coding
│  ├─ Detail panel (1/3 width)
│  ├─ Selecting Nutmeg highlights both overlay sections
│  └─ Selecting P1E/P2W does not auto-select Nutmeg
│
├─ irrigation-charts-hybrid.tsx
│  ├─ Chart 1: Runtime & Water Pumped (dual-axis bar)
│  ├─ Chart 2: Water per Tree (bar chart)
│  ├─ Chart 3: Daily Trend (dual-axis line, 10 days)
│  └─ All charts include all 6 zones
│
└─ irrigation-zone-table-hybrid.tsx
   ├─ Zone filter dropdown
   ├─ Sortable columns (click header)
   ├─ Displays all mock records for date
   └─ Indian number formatting
```

---

## Six-Zone System

### Zone Definitions

| Zone ID | Name      | Crop      | Trees | Water Rate | Notes                        |
|---------|-----------|-----------|-------|------------|------------------------------|
| P1E     | Plot 1 E  | Coconut   | 125   | 100 L/tr/h | Physical plot                |
| P1W     | Plot 1 W  | Coconut   | 110   | 100 L/tr/h | Physical plot                |
| P2E     | Plot 2 E  | Coconut   | 135   | 100 L/tr/h | Physical plot                |
| P2W     | Plot 2 W  | Coconut   | 128   | 100 L/tr/h | Physical plot + NM overlap   |
| JF      | Jackfruit | Jackfruit | 42    | 60 L/tr/h  | Physical plot                |
| NM      | Nutmeg    | Nutmeg    | 35    | 80 L/tr/h  | Operational overlay (P1E+P2W) |

### Nutmeg Overlap Rules

- **Display**: Nutmeg is shown as a hatched overlay on the map, spanning portions of P1E and P2W
- **Not a physical plot**: Nutmeg is NOT a separate sixth land block; it's an independent operational zone that uses land in two existing plots
- **Independence**: Nutmeg has its own motor, valve, irrigation records, and status—completely independent from P1E and P2W
- **Selection behavior**:
  - Clicking Nutmeg on the map highlights BOTH overlay sections (on P1E and P2W)
  - Clicking P1E or P2W does NOT automatically select Nutmeg
  - Each zone is independently selectable
- **Visibility**: Nutmeg overlay is always visible on the map (faint when not selected, bold when selected)
- **Records**: Nutmeg has its own irrigation records; irrigation of Nutmeg does not affect P1E or P2W records

---

## Calculation Rules

### Water Calculations

```
Pump Capacity (fixed):          50,000 L/hour

Crop-Specific Rates (per tree per hour):
  • Coconut (P1E, P1W, P2E, P2W): 100 L/tree/hour
  • Jackfruit (JF):               60 L/tree/hour
  • Nutmeg (NM):                  80 L/tree/hour (FIXED, never changes)

Runtime (minutes):              From irrigation_records.runtimeMinutes
Total Water:                    runtimeMinutes / 60 × 50,000
Water per Tree:                 runtimeMinutes / 60 × crop_rate
Status Determination:
  • Irrigated:                   ≥1 record for selected date
  • No Record:                   0 records for selected date
  • Partial:                     ≥2 records for selected date
```

### Number Formatting

- **Water (Litres)**: Indian format: 1,23,456 L (NOT 123,456 L)
- **Time**: 3h 30m (NOT 3.5 hours or 3:30)
- **Date**: DD MMM YYYY or MMM DD (based on locale)

---

## Mock Data Structure

### ZONE_CONFIG Object

```typescript
type ZoneId = "P1E" | "P1W" | "P2E" | "P2W" | "JF" | "NM"

interface ZoneConfig {
  abbr: string              // "P1E", "P1W", etc.
  name: string              // "Plot 1 East", etc.
  crop: string              // "Coconut", "Jackfruit", "Nutmeg"
  treeCount: number
  waterRateLPerTreePerHour: number
  overlaps?: ZoneId[]       // ["P1E", "P2W"] for NM only
}
```

### IRRIGATION_RECORDS Array

```typescript
interface IrrigationRecord {
  date: string              // "2026-07-16"
  zoneId: ZoneId
  startTime: string         // "06:30"
  endTime: string           // "10:00"
  runtimeMinutes: number    // 210 = 3h 30m
  totalWaterLitres: number  // calculated or actual
  waterPerTreeLitres: number // calculated or actual
}
```

### Sample Data

Included: 8 irrigation records across all 6 zones for today and yesterday.
- All zones show "Irrigated" status for today
- Records demonstrate Nutmeg independence from P1E/P2W
- Realistic runtime and water values

---

## API Replacement Points

Replace mock data functions with backend API calls at these locations:

### 1. **Initial Page Load** (app/irrigation-management/page.tsx)
```typescript
// REPLACE:
import { IRRIGATION_RECORDS, getAllZoneDetails } from "@/lib/irrigation-mock-data"

// WITH:
async function fetchIrrigationRecords(date: string) {
  const response = await fetch(`/api/irrigation/records?date=${date}`)
  return response.json()
}
```

### 2. **Zone Details** (components/irrigation/irrigation-map-with-details.tsx)
```typescript
// REPLACE:
const selectedZone = getZoneDetails(selectedZoneId, dateStr)

// WITH:
const response = await fetch(`/api/irrigation/zones/${selectedZoneId}?date=${dateStr}`)
const selectedZone = await response.json()
```

### 3. **Charts Data** (components/irrigation/irrigation-charts-hybrid.tsx)
```typescript
// REPLACE:
const records = IRRIGATION_RECORDS.filter((r) => r.date === dateStr)

// WITH:
const response = await fetch(`/api/irrigation/records?date=${dateStr}`)
const records = await response.json()
```

### 4. **Table Data** (components/irrigation/irrigation-zone-table-hybrid.tsx)
```typescript
// REPLACE:
let filteredRecords = IRRIGATION_RECORDS.filter((r) => r.date === dateStr)

// WITH:
const response = await fetch(`/api/irrigation/records?date=${dateStr}&zone=${zoneFilter}`)
const filteredRecords = await response.json()
```

### 5. **Export Functionality** (components/irrigation/irrigation-period-selector.tsx)
```typescript
// REPLACE: Mock export button

// WITH:
async function handleExport(dateStr: string) {
  const response = await fetch(`/api/irrigation/export?date=${dateStr}`)
  // Download CSV or Excel file
}
```

### 6. **Refresh Functionality** (components/irrigation/irrigation-period-selector.tsx)
```typescript
// REPLACE: Mock refresh button

// WITH:
async function handleRefresh() {
  const response = await fetch(`/api/irrigation/refresh`, { method: "POST" })
  // Reload page or update data
}
```

---

## Responsive Behavior

### Desktop (1200px+)
- All elements visible without scrolling (if viewport height ≥ 900px)
- Period controls and 5 summary cards in full width
- 6 zone cards visible in a horizontal row
- Map (2/3) and detail panel (1/3) side-by-side
- 3 chart panels displayed
- Table visible below

### Tablet (768px–1199px)
- Period controls and summary cards wrap appropriately
- 6 zone cards stack into 2–3 rows
- Map and detail panel stack vertically
- Charts stack and adjust height
- Table remains in its own scrollable section

### Mobile (<768px)
- No page-level horizontal scroll
- All sections stack vertically
- Period controls wrap (buttons may stack)
- Summary cards stack into 1–2 columns
- 6 zone cards may show 2–3 per row or stack
- Map scales down but remains readable
- Detail panel displays below map
- Charts scale down (may require horizontal scroll within chart container)
- Table has isolated horizontal scroll (inside the table, not page-level)

---

## Known Mock-Only Interactions

These features use mock behavior and require backend integration:

1. **Refresh Button**: Does not actually refresh data; mock-only
2. **Export Button**: Opens a mock export dialog; no real export function
3. **Custom Date Range**: Date selection works, but only "Today" and "Yesterday" actually change displayed records
4. **Last 7 Days / Current Cycle**: Period buttons are visible but filter mock data to today only
5. **Search**: No search functionality implemented; table shows all records for date
6. **Sorting**: Works on mock data; requires real API to sort on backend
7. **Pagination**: No pagination implemented; all records shown
8. **Motor/Valve Filters**: Not implemented; zone filter only

---

## Testing Checklist

### Pre-Integration QA

- [ ] All 6 zones display in zone status cards
- [ ] Selecting a zone highlights it in the map and updates the detail panel
- [ ] Nutmeg overlay shows as hatched pattern on P1E and P2W
- [ ] Selecting Nutmeg highlights both overlay sections
- [ ] Selecting P1E or P2W does NOT select Nutmeg
- [ ] 5 summary cards calculate correctly
- [ ] 3 charts display all 6 zones
- [ ] Chart 1: Runtime in hours, Water in thousands litres (dual-axis)
- [ ] Chart 2: Water per tree shows crop rates (NM=80, Coconut=100, JF=60)
- [ ] Chart 3: Daily trend spans 10 days, dual-axis
- [ ] Table displays all records for the date
- [ ] Zone filter in table works (All Zones, P1E, P1W, P2E, P2W, JF, NM)
- [ ] Table columns are sortable
- [ ] Indian number formatting applied (1,23,456)
- [ ] Operational alerts show for missing/partial zones
- [ ] No page-level horizontal scroll on mobile
- [ ] Map remains readable on mobile
- [ ] Charts scale appropriately on tablet and mobile
- [ ] Period selector buttons are functional (mock behavior acceptable)
- [ ] Refresh and Export buttons are present (mock behavior acceptable)

### Post-Integration Testing

- [ ] Real data loads from API
- [ ] All calculations match backend
- [ ] Sorting works with real data
- [ ] Filtering works with real data
- [ ] Export generates real file
- [ ] Refresh reloads real data
- [ ] All 6 zones have real records
- [ ] Nutmeg independence verified with real data
- [ ] Performance acceptable with real data

---

## Styling and Design Tokens

### Colors Used

- **Primary Green**: #16a34a (zone selected, active states)
- **Irrigated Green**: #10b981 (zone status good)
- **No Record Gray**: #d1d5db (zone status missing)
- **Partial Amber**: #f59e0b (zone status partial)
- **Alert Red**: #ef4444 (issue status)
- **Nutmeg Brown**: #b45309 (overlay color)

### Fonts

- **Title**: Bold, Large (3xl)
- **Card Titles**: Semibold (sm font)
- **Values**: Bold (lg font)
- **Labels**: Medium (xs font, muted foreground)

### Layout

- Uses Flexbox for responsive design
- Grid layout for multi-column sections
- Panel component for card-like containers
- All spacing uses Tailwind scale (gap-4, p-3, etc.)

---

## Files to Integrate Into Main Project

```
Copy these files to your existing MFMS project:

app/irrigation-management/page.tsx                      → Main page
lib/irrigation-mock-data.ts                              → Mock data
components/irrigation/irrigation-period-selector.tsx     → Period controls
components/irrigation/irrigation-summary-cards.tsx       → Summary stat cards
components/irrigation/zone-status-cards.tsx              → 6 zone cards
components/irrigation/irrigation-map-with-details.tsx    → Map + detail panel
components/irrigation/irrigation-charts-hybrid.tsx       → 3 charts
components/irrigation/irrigation-zone-table-hybrid.tsx   → Records table

Dependencies (already exist in MFMS):
  components/farm/dashboard-shell.tsx
  components/farm/header.tsx
  components/farm/panel.tsx
  components/farm/export-button.tsx
  lib/utils.ts
```

---

## Environment Notes

- **No environment variables required** for the frontend
- **No backend dependencies** to set up
- **No database** to configure
- **No API keys** needed
- **No authentication changes**
- **Mock data**: Stored in lib/irrigation-mock-data.ts (replace with API calls)

---

## Important Notes for Codex

1. **Route**: Maintain `/irrigation-management` route name (do not change)
2. **Sidebar Navigation**: Home navigation link remains available
3. **No Logout Changes**: Do not modify logout button behavior
4. **No Other Pages**: No changes to other MFMS modules
5. **Six Zones**: Ensure backend supports all 6 zones (including NM)
6. **Nutmeg Independence**: Nutmeg must have independent records, never derived from P1E/P2W
7. **Water Rates**: Implement fixed rates per crop; Nutmeg is always 80 L/tree/hour
8. **Indian Formatting**: Ensure all numbers use Indian locale (1,23,456)
9. **Responsive**: Test on desktop (1200px), tablet (768px), and mobile (<768px)

---

## Summary

This frontend redesign provides a complete, production-ready irrigation management interface ready for Codex backend integration. All 6 zones are fully supported with Nutmeg as an independent operational overlay. Replace mock data functions with real API calls, ensure backend supports the six-zone system and independent Nutmeg status, and the module is ready for production deployment.

**Status**: Frontend redesign complete and ready for Codex integration with the existing MFMS API.
