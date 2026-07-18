# Nutmeg Zone - Quick Reference

## What Changed?

**Before**: 5 irrigation zones  
**Now**: 6 irrigation zones (added Nutmeg overlay)

## The 6 Zones

| # | Zone | Code | Physical? | Overlaps | Water Rate |
|---|------|------|-----------|----------|------------|
| 1 | Plot 1 East | P1E | ✅ Yes | — | Database (Coconut rate) |
| 2 | Plot 1 West | P1W | ✅ Yes | — | Database (Coconut rate) |
| 3 | Plot 2 East | P2E | ✅ Yes | — | Database (Coconut rate) |
| 4 | Plot 2 West | P2W | ✅ Yes | — | Database (Coconut rate) |
| 5 | Jackfruit | JF | ✅ Yes | — | Database (Jackfruit rate) |
| 6 | Nutmeg | NM | ❌ Operational | P1E, P2W | **80 L/tree/hour** |

## Nutmeg Zone

### What it is
- An **operational irrigation zone** (not a physical plot)
- Spans **portions** of Plot 1 East and Plot 2 West
- Has **independent irrigation records** and status
- Uses a **fixed water rate** of 80 litres per tree per hour

### Where it is
```
P1E ← Nutmeg overlaps this area (upper left)
P2W ← Nutmeg overlaps this area (lower right)
```

### Key characteristics
- **ZoneId**: "NM"
- **Water rate**: 80 L/tree/hour (FIXED, do not change)
- **Status**: Independent (can be irrigated while P1E/P2W are not)
- **Display**: Hatched overlay on map with dashed border
- **Included in**: All dashboard summaries, charts, and tables

## Implementation Details

### Files Modified
1. `lib/irrigation-data.ts` — Added NM zone, overlap tracking, Nutmeg calculation
2. `components/irrigation/irrigation-map-section.tsx` — Added Nutmeg overlay on map

### Database Integration Points
1. **Zone filter**: Must support NM in WHERE zone_id IN ('P1E','P1W','P2E','P2W','JF','NM')
2. **Water calculation**: For NM, use `runtime_hours × 80` (not any other rate)
3. **Independent records**: NM must have its own motor_runtime entries
4. **Trend data**: Include NM as 6th line in water_per_tree_trend

### API Changes
- Summary stat "Zones Irrigated": Now shows "X / 6" instead of "X / 5"
- Zone list: Now returns 6 zones instead of 5
- Trend chart: Now includes NM data point with 80L/hour value

## Frontend UX

### Map Display
- **Physical zones**: Solid-filled rectangles (green when irrigated, grey when not)
- **Nutmeg overlay**: Hatched pattern on top of P1E and P2W areas
- **Selection**: Click any zone (physical or Nutmeg) to see details
- **Visibility**: P1E and P2W boundaries always visible even when Nutmeg selected

### Zone Detail Panel
Shows when zone selected:
- Zone name
- **If Nutmeg**: Alert box saying "This zone overlaps portions of Plot 1 East and Plot 2 West"
- Motor/valve information
- Water supply data
- Last irrigated date
- Status badge

### Zone Table
Has 6 rows:
| Zone | Motor | Valve | Water (L) | Water/Tree (L) | Last Irrigated | Status |
|------|-------|-------|-----------|----------------|----------------|--------|
| Plot 1 East | ... | ... | ... | ... | ... | ... |
| Plot 1 West | ... | ... | ... | ... | ... | ... |
| Plot 2 East | ... | ... | ... | ... | ... | ... |
| Plot 2 West | ... | ... | ... | ... | ... | ... |
| Jackfruit | ... | ... | ... | ... | ... | ... |
| **Nutmeg** | ... | ... | ... | **80/tree/hour** | ... | ... |

### Trend Chart
6 lines, each color-coded:
- P1E (green solid)
- P1W (green solid)
- P2E (green solid)
- P2W (green solid)
- JF (orange solid)
- **NM (brown/tan dashed)** ← Flat line at 80

## Backend Checklist

- [ ] Add "NM" to zone_id column in motor_runtime table
- [ ] Create NM irrigation records in database
- [ ] Ensure motor_runtime query includes NM records
- [ ] Implement NM water calc: `runtime_hours * 80`
- [ ] Add NM to trend data query
- [ ] Update summary "Zones Irrigated" from /5 to /6
- [ ] Test: Select NM in dropdown → correct data shown
- [ ] Test: NM and P1E both in results when both irrigated
- [ ] Test: P1E status independent from NM status

## Common Questions

**Q: Why is Nutmeg separate from P1E?**  
A: Nutmeg trees have different irrigation requirements (80L/hour vs Coconut rate) and are managed as a separate operational zone, even though they grow on portions of the same physical plots.

**Q: What if P1E is irrigated but Nutmeg isn't?**  
A: This is normal and supported. Each zone tracks independently. Status card for P1E shows one status, NM shows a different status.

**Q: What if the Nutmeg area gets larger?**  
A: Update the SVG path coordinates in irrigation-map-section.tsx to expand the hatched overlay. The operational zone definition stays the same.

**Q: Can I use a different water rate for Nutmeg?**  
A: No. The rate is fixed at 80L/tree/hour. This is a business rule, not configurable per-irrigation.

**Q: Does Nutmeg count toward total farm area?**  
A: No. Nutmeg overlaps P1E and P2W but is not counted as a separate physical area. Operational zones ≠ physical zones.

## Water Calculation Example

**Scenario**: Nutmeg irrigated for 3.5 hours with 240 trees

```
Runtime: 3.5 hours
Water per tree: 3.5 × 80 = 280 litres/tree
Total water: 280 × 240 = 67,200 litres
```

## Status Colors

Both physical zones and Nutmeg use the same status colors:
- 🟢 Green → Target achieved
- 🟡 Yellow → Slightly low
- 🟠 Orange → Low
- 🔴 Red → Critical
- ⚫ Grey → No data

---

## Key Files

```
lib/irrigation-data.ts
├── ZoneId type (now includes "NM")
├── zoneOverlaps mapping
├── zones array (now 6 zones)
├── waterPerTreeTrend (now includes NM: 80)
├── calculateNutmegWaterPerTree() helper
└── isOverlappingZone() helper

components/irrigation/irrigation-map-section.tsx
├── zoneShapes with Nutmeg overlay patches
├── SVG pattern for hatching
├── Zone detail panel with overlap warning
└── Interactive map rendering

public/nutmeg-zone-map-design.png
└── Visual reference for zone layout
```

---

## Testing Scenarios

### Scenario 1: Both Irrigated
- P1E: Irrigated, 670L/tree
- NM: Irrigated, 80L/tree ✓
- Map: Both colors visible, Nutmeg hatched overlay on top
- Table: Two separate rows with different water/tree values

### Scenario 2: Only Nutmeg Irrigated
- P1E: No record
- NM: Irrigated, 80L/tree ✓
- Map: Only NM hatched area highlighted
- Summary: "1 / 6 zones irrigated"

### Scenario 3: Only P1E Irrigated
- P1E: Irrigated, 670L/tree
- NM: No record
- Map: P1E solid green, Nutmeg overlay grey
- Summary: "1 / 6 zones irrigated" (only P1E counted)

---

**Version**: 1.0  
**Last Updated**: 2026-07-19  
**Status**: Ready for backend integration
