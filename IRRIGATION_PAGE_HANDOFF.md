# Irrigation Management Page – Handover to Codex

## Overview
The Irrigation Management UI is complete, approved, and ready for Codex integration. This is a **static UI-only page** with mock data and placeholder map behavior. No backend, API, or live data connections exist yet.

## Page Route
```
/irrigation-management
```

## Files Created or Modified

### New Files
- `lib/irrigation-data.ts` — Mock data file (single source of truth for all zones, totals, and trends)
- `components/irrigation/irrigation-map-section.tsx` — Interactive SVG map with clickable zones and detail panel (client component)
- `components/irrigation/irrigation-charts.tsx` — Bar and line charts for water and trend visualization
- `components/irrigation/irrigation-period-selector.tsx` — Visual-only period selection controls
- `components/irrigation/irrigation-zone-table.tsx` — Zone performance table
- `app/irrigation-management/page.tsx` — Main page (client component using DashboardShell)

### Modified Files
- `globals.css` — Added `--warning` yellow token for risk bands (used elsewhere in dashboard, harmless addition)

## Current Mock Data Structure

**File:** `lib/irrigation-data.ts`

**Zones (five fixed codes):**
- `P1E` — Plot 1 East
- `P1W` — Plot 1 West
- `P2E` — Plot 2 East
- `P2W` — Plot 2 West
- `JF` — Jackfruit

**Current Zone Data (all placeholder):**
```typescript
interface Zone {
  id: PlotId                    // P1E | P1W | P2E | P2W | JF
  name: string                  // e.g., "Plot 1 East"
  plot: string                  // "Database Value" (placeholder)
  motor: string                 // "Database Value" (placeholder)
  valveOpenTime: string         // "--" (placeholder)
  totalWaterSupplied: number    // 0 (placeholder)
  numberOfTrees: number         // 0 (placeholder)
  waterPerTree: number          // 0 (placeholder)
  lastIrrigatedDate: string     // "--" (placeholder)
  daysSinceIrrigation: number   // 0 (placeholder)
  status: RiskLevel             // "target" | "low" | "very-low" | "critical"
  statusLabel: string           // Human-readable status name
}
```

**Additional Mock Data:**
- `totalWater`: Total water supplied (all zones combined) — currently returns 0
- `totalRuntime`: Total motor runtime — currently returns "0 h 0 m"
- `waterTrendData`: 10 inspection dates × 5 zones (water per tree trends)
- `areaInfections`: Placeholder infection status for two areas

## Components Used

### Map Section (`irrigation-map-section.tsx`)
- **Client component** with `useState` for zone selection
- Renders an SVG farm map with five color-coded, clickable polygons
- Selected zone displays a detail panel with all zone information
- Semi-transparent fills allow background visibility
- All five zones fit within the map card without scrolling

### Charts (`irrigation-charts.tsx`)
- **Bar chart:** "Water Supplied by Zone" (all zones, mock values = 0)
- **Line chart:** "Water per Tree Trend" (10 dates, 5 zones)

### Period Selector (`irrigation-period-selector.tsx`)
- **Visual-only buttons:** Today, Yesterday, Last 7 Days, Current Irrigation Cycle, Custom Date Range
- Refresh and Export buttons (visual-only)
- No backend logic; Codex will wire this up to period filters

### Zone Table (`irrigation-zone-table.tsx`)
- Displays all five zones with columns: Rank, Zone, Plot, Motor, Status
- Clickable rows (no functionality yet; Codex can add filtering)

## Placeholder Map Behavior

**Current State:**
- SVG-based static map with five hard-coded zone polygons
- Zone names and status colors rendered
- Clicking a zone updates the detail panel (mock-only, no API call)
- Map shows "Orthomosaic Placeholder" in the background

**What Needs to be Connected:**
1. Replace the SVG map with the actual plot orthomosaics (PMTiles or static images):
   - `plot1-orthomosaic.png` (exists in `public/mfms/beetle/`)
   - `plot2-orthomosaic.png` (exists in `public/mfms/beetle/`)
   - `jackfruit-orthomosaic.png` (to be provided or generated)

2. Load zone geometries from `irrigation_zones.geojson` instead of hard-coded SVG paths

3. Connect zone selection to populate the detail panel with live data from the database

## Data Integration Points for Codex

### 1. Replace Mock Zone Data
- **File:** `lib/irrigation-data.ts` → `zones` array
- **Action:** Connect to database to fetch zone information (plot, motor, valve open time, tree count, etc.)
- **Zone IDs:** Use the five fixed codes: `P1E`, `P1W`, `P2E`, `P2W`, `JF`

### 2. Connect Motor Runtime and Valve Times
- **Source:** Existing motor runtime data (already available in the dashboard)
- **Integration:** Update `totalRuntime` and individual zone `valveOpenTime` from motor data
- **Note:** The page references existing motor data; reuse those queries

### 3. Connect Water Supply Calculations
- **Source:** Existing irrigation calculations (already in the system)
- **Integration:** Update `totalWaterSupplied` and `waterPerTree` per zone
- **Note:** The dashboard already has water calculation logic; reuse it

### 4. Load Zone Geometries
- **File:** `irrigation_zones.geojson` (to be placed in `public/` or served from API)
- **Integration:** Replace hard-coded SVG polygon paths with GeoJSON coordinates
- **Visualization:** Use existing map library or enhance SVG renderer to consume GeoJSON

### 5. Connect Orthomosaics
- **Plot 1 Orthomosaic:** Use existing `plot1.mbtiles` or `plot1.pmtiles` (from beetle-trap page)
- **Plot 2 Orthomosaic:** Use existing `plot2.mbtiles` or `plot2.pmtiles` (from beetle-trap page)
- **Jackfruit Orthomosaic:** Provide or source from storage
- **Implementation:** Replace SVG background placeholder with actual raster tiles or static images

### 6. Connect Water Trend Data
- **File:** `lib/irrigation-data.ts` → `waterTrendData`
- **Action:** Fetch trend data from database for the selected period (Today, Last 7 Days, etc.)
- **Chart:** The line chart will automatically re-render when data changes

### 7. Connect Period Selector
- **File:** `components/irrigation/irrigation-period-selector.tsx`
- **Action:** Wire up the buttons to filter and fetch data for the selected period
- **Behavior:** On period change, update all charts and tables with new data

## UI Preservation Requirements

**CODEX MUST:**
- ✅ Preserve all approved layout, spacing, and card structure
- ✅ Preserve all typography (fonts, sizes, weights)
- ✅ Preserve all colors (design tokens used throughout)
- ✅ Preserve responsive behavior (mobile, tablet, desktop)
- ✅ Preserve chart styling and axes
- ✅ Preserve table structure and columns
- ✅ Preserve the DashboardShell header and sidebar integration

**CODEX MUST NOT:**
- ❌ Redesign the page
- ❌ Change the layout structure
- ❌ Modify colors or color meanings
- ❌ Alter typography or spacing
- ❌ Remove or restructure sections
- ❌ Add new sections or panels without explicit approval

## Data Schema Reference

**Zone Risk Levels (from `irrigation-data.ts`):**
```typescript
type RiskLevel = "target" | "low" | "very-low" | "critical"

const statusColors = {
  target: { label: "Target Achieved", bg: "bg-green-100", text: "text-green-700", svg: "rgb(34, 197, 94)" },
  low: { label: "Slightly Low", bg: "bg-yellow-100", text: "text-yellow-700", svg: "rgb(234, 179, 8)" },
  very-low: { label: "Low", bg: "bg-orange-100", text: "text-orange-700", svg: "rgb(249, 115, 22)" },
  critical: { label: "Critical", bg: "bg-red-100", text: "text-red-700", svg: "rgb(239, 68, 68)" },
}
```

## Implementation Checklist for Codex

- [ ] Load `irrigation_zones.geojson` and replace SVG paths
- [ ] Connect zone data queries from database
- [ ] Connect motor runtime and valve-open-time data
- [ ] Connect water supply calculations
- [ ] Implement period selector filtering
- [ ] Load and display orthomosaics (Plot 1, Plot 2, Jackfruit)
- [ ] Test zone selection and detail panel updates
- [ ] Test chart updates when data changes
- [ ] Test responsive behavior across all screen sizes
- [ ] Verify all five zones visible without scrolling
- [ ] Validate water trend data rendering
- [ ] Test table sorting/filtering (if enabled)

## Ready for Handover

The page is complete, tested, and approved. All mock data is isolated in `lib/irrigation-data.ts`. No backend, API, or live data connections exist. Codex can proceed with confidence that the UI will not change during integration.
