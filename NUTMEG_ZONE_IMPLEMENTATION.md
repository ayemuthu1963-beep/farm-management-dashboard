# Nutmeg Irrigation Zone - Implementation Guide

**Date**: 2026-07-19  
**Status**: Complete and tested  
**Type**: Overlapping operational zone (6th zone)

## Overview

The Irrigation Management system now supports **six irrigation zones**, including **Nutmeg (NM)** as an overlapping operational zone that spans portions of Plot 1 East (P1E) and Plot 2 West (P2W).

### Key Principle

**Nutmeg is NOT a physical plot.** It is an **operational irrigation zone** with:
- Independent irrigation records and status
- Independent motor/valve assignment
- Independent water per tree calculation (fixed at 80L/tree/hour)
- Visual overlay on the farm map showing its overlap with P1E and P2W
- Separate tracking in all dashboards, charts, and tables

---

## Physical Layout

### 5 Physical Zones (Non-Overlapping)
1. **Plot 1 East (P1E)** - Physical boundary
2. **Plot 1 West (P1W)** - Physical boundary
3. **Plot 2 East (P2E)** - Physical boundary
4. **Plot 2 West (P2W)** - Physical boundary
5. **Jackfruit (JF)** - Physical boundary

### 1 Operational Overlay Zone
6. **Nutmeg (NM)** - Overlaps P1E and P2W
   - Part of NM tree plantation lies within P1E boundary
   - Part of NM tree plantation lies within P2W boundary
   - NM has independent irrigation operations

### Farm Area Calculation
- **Total farm area**: Do NOT double-count the Nutmeg overlap
- **Operational zones**: 6 zones (includes Nutmeg as 6th operational zone)
- **Physical zones**: 5 zones (Nutmeg is NOT counted as a separate physical zone)

---

## Code Changes

### 1. Type System (`lib/irrigation-data.ts`)

#### ZoneId Type
```typescript
export type ZoneId = "P1E" | "P1W" | "P2E" | "P2W" | "JF" | "NM"
```

#### Zone Overlap Tracking
```typescript
export const zoneOverlaps: Record<ZoneId, ZoneId[]> = {
  P1E: [],
  P1W: [],
  P2E: [],
  P2W: [],
  JF: [],
  NM: ["P1E", "P2W"], // Nutmeg overlaps these zones
}
```

#### Nutmeg Zone Record
```typescript
{
  id: "NM",
  name: "Nutmeg",
  plot: "Overlaps P1E & P2W",
  motor: "Database Value",
  valveOpenTime: "--",
  totalWaterSupplied: 0,
  numberOfTrees: 0,
  waterPerTree: 0,
  lastIrrigatedDate: "--",
  daysSinceIrrigation: 0,
  status: "target",
  statusLabel: "Target Achieved",
}
```

#### Nutmeg Water Calculation
```typescript
// Fixed rate: 80 litres per tree per hour
const NUTMEG_LITRES_PER_TREE_PER_HOUR = 80

export function calculateNutmegWaterPerTree(runtimeHours: number): number {
  return runtimeHours * NUTMEG_LITRES_PER_TREE_PER_HOUR
}
```

#### Helper Functions
```typescript
// Check if a zone is an overlapping zone
export function isOverlappingZone(zoneId: ZoneId): boolean {
  return zoneId === "NM"
}

// Get zones that overlap this zone
export function getOverlappingZones(zoneId: ZoneId): ZoneId[] {
  return zoneOverlaps[zoneId]
}
```

### 2. Trend Data

Updated `TrendPoint` interface to include Nutmeg:
```typescript
export interface TrendPoint {
  date: string
  P1E: number
  P1W: number
  P2E: number
  P2W: number
  JF: number
  NM: number  // Fixed at 80 (litres per tree per hour)
}
```

### 3. Map Component (`components/irrigation/irrigation-map-section.tsx`)

#### Zone Shapes Definition
```typescript
const zoneShapes = [
  // Physical zones
  { id: "P1E", label: "PLOT 1 EAST", path: "...", isPhysicalZone: true },
  // ... other physical zones ...
  
  // Nutmeg overlay (TWO patches showing overlap areas)
  { id: "NM", path: "M 12 12 L 24 12 L 24 24 L 12 24 Z", isOverlay: true },
  { id: "NM", path: "M 76 42 L 88 42 L 88 54 L 76 54 Z", isOverlay: true },
]
```

#### SVG Rendering Strategy
1. **Physical zones** rendered with solid fill and status color
2. **Nutmeg overlay** rendered with:
   - Hatched/patterned fill (via SVG pattern element)
   - Dashed border (strokeDasharray="2,2")
   - Semi-transparent opacity
   - Two path patches (one over P1E area, one over P2W area)

#### Interaction
- Click on physical zone → shows that zone's details
- Click on Nutmeg overlay → shows Nutmeg's independent status
- Physical zones stay visible when Nutmeg is selected
- Nutmeg overlay does not hide the underlying P1E and P2W boundaries

### 4. Zone Details Panel

When Nutmeg is selected, shows:
```
Zone Name: Nutmeg
⚠️ This zone overlaps portions of Plot 1 East and Plot 2 West
Plot / Location: Overlaps P1E & P2W
Motor: [Database Value]
Valve Open Time: [Database Value]
Total Water Supplied: [Database Value]
Number of Trees: [Database Value]
Water per Tree: [Database Value] (80L/tree/hour independent rate)
Last Irrigated: [Database Value]
Status: [Irrigation Status]
```

---

## Backend Integration Requirements

### 1. Motor Runtime Table
Must support NM zone:
```sql
SELECT * FROM motor_runtime 
WHERE zone_id IN ('P1E', 'P1W', 'P2E', 'P2W', 'JF', 'NM')
```

### 2. Water Calculation
For Nutmeg (NM):
```
Water Per Tree = Runtime (hours) × 80 litres/tree/hour
Total Water = Water Per Tree × Number of Nutmeg Trees
```

### 3. Independent Status
- Query motor_runtime for NM records independently from P1E and P2W
- Do NOT derive NM irrigation from P1E or P2W records
- Each zone has independent last_irrigation_date

### 4. Trend Data
Include NM in trend queries:
```sql
SELECT zone_id, date, water_per_tree 
FROM irrigation_trend
WHERE zone_id = 'NM'
AND date BETWEEN @start_date AND @end_date
```

### 5. Summary Calculations

**Zones Irrigated Count**:
```
Count zones from [P1E, P1W, P2E, P2W, JF, NM] with irrigation records in period
Total: 6 (not 5)
```

**Total Water Supplied**:
```
SUM(water) WHERE zone_id IN ('P1E', 'P1W', 'P2E', 'P2W', 'JF', 'NM')
Do NOT double-count area where Nutmeg overlaps
```

---

## UI/UX Behavior

### Dashboard Summary
- **Zones Irrigated**: Shows count out of 6 (e.g., "5 / 6")
- **Total Water**: Aggregates from all 6 zones
- **Total Motor Runtime**: Includes Nutmeg runtime

### Zone Table
Includes all 6 rows:
| Zone | Motor | Valve Time | Total Water | Water/Tree | Status |
|------|-------|-----------|------------|-----------|--------|
| Plot 1 East | ... | ... | ... | ... | ... |
| Plot 1 West | ... | ... | ... | ... | ... |
| Plot 2 East | ... | ... | ... | ... | ... |
| Plot 2 West | ... | ... | ... | ... | ... |
| Jackfruit | ... | ... | ... | ... | ... |
| **Nutmeg** | ... | ... | ... | ... | ... |

### Water Per Tree Trend Chart
- X-axis: Date
- Y-axis: Water per tree (litres)
- 6 lines: P1E, P1W, P2E, P2W, JF, **NM** (flat at 80L if irrigated)

### Farm Map
- Physical zones: Solid coloured boxes
- Nutmeg overlay: Hatched pattern with dashed border on top of P1E and P2W
- Selection: Can select any of 6 zones

---

## Status Mapping

Nutmeg uses the same status types as physical zones:
- `target` → "Target Achieved" ✓
- `low` → "Slightly Low" ⚠️
- `critical` → "Critical" ❌
- `very-low` → "Low" ⚠️
- `no-data` → "No Data" ⚡

---

## Testing Checklist

- [ ] 6 zones appear in zone list
- [ ] Nutmeg appears in zone table
- [ ] Nutmeg appears in trend chart (with 80L/hour line)
- [ ] Nutmeg overlay visible on map (hatched pattern on P1E and P2W areas)
- [ ] Clicking Nutmeg overlay selects NM zone
- [ ] Zone detail panel shows "Overlaps P1E & P2W" warning
- [ ] Summary shows "X / 6 zones irrigated"
- [ ] Nutmeg water = (runtime hours) × 80
- [ ] P1E and P2W boundaries remain visible when Nutmeg selected
- [ ] Nutmeg records independent from P1E/P2W records

---

## Important Notes

### ✅ DO
- Treat Nutmeg as a distinct operational zone
- Store independent motor/valve/water records for Nutmeg
- Use 80L/tree/hour exclusively for Nutmeg calculations
- Show Nutmeg overlay clearly on maps without hiding underlying zones
- Include Nutmeg in all summary counts (6 zones total)

### ❌ DON'T
- Merge Nutmeg records into P1E or P2W
- Use Coconut water rate (670-680L/tree) for Nutmeg
- Count Nutmeg as a separate physical plot (it's operational only)
- Double-count farm area due to Nutmeg overlap
- Hide P1E and P2W when Nutmeg overlay is active

---

## Summary

Nutmeg is the **6th operational irrigation zone** with:
1. **Independent operations** - separate motor, valve, records
2. **Fixed water rate** - 80L/tree/hour (non-negotiable)
3. **Visual overlay** - shown on map as hatched pattern spanning P1E and P2W
4. **Operational tracking** - included in all dashboards and calculations
5. **Transparent hierarchy** - always shows underlying plot boundaries

The implementation maintains **data integrity** (no double-counting) while providing **operational transparency** (Nutmeg appears as independent 6th zone).
