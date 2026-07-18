# Irrigation Dashboard - Visual Reference Guide

## Page Layout (Desktop 1200px+)

```
┌─────────────────────────────────────────────────────────────┐
│ [MUTHU'S] DIGITAL FARM MANAGEMENT SYSTEM  [Home]            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ IRRIGATION MANAGEMENT                                        │
│ Water distribution by irrigation zone                        │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ ┌─ DATE & PERIOD CONTROLS ─────────────────────────────┐   │
│ │ [Today] [Yesterday] [Last 7 Days] [Cycle] [Custom ▼] │   │
│ │                           [Refresh] [📊 Export]       │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ Summary Cards (5 cards in 1 row):                           │
│ ┌─────────────┬─────────────┬─────────────┬─────────────┬──┐│
│ │ 14h 30m     │ 1,45,000 L  │   4 / 6     │   2 / 6     │  ││
│ │ Total       │ Total Water │ Zones       │ Zones Not   │  ││
│ │ Runtime     │ Pumped      │ Irrigated   │ Irrigated   │  ││
│ └─────────────┴─────────────┴─────────────┴─────────────┴──┘│
│ └──────────── Avg Water/Tree: 1,234 L ─────────────────────┘│
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ ZONE STATUS (6 cards, 1 row):                               │
│ ┌──────┬──────┬──────┬──────┬──────┬──────┐                │
│ │ P1E  │ P1W  │ P2E  │ P2W  │  JF  │  NM  │ Nutmeg        │
│ │━━━━━ │ —    │ —    │━━━━ │ —    │ —    │ Overlaps      │
│ │ 3h   │      │      │ 3h   │      │      │ P1E & P2W     │
│ │ 125k │      │      │ 107k │      │      │               │
│ └──────┴──────┴──────┴──────┴──────┴──────┘                │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ MAP (2/3) & DETAILS (1/3):                                  │
│ ┌──────────────────────────────┬──────────────────────────┐ │
│ │ FARM IRRIGATION MAP          │ ZONE DETAILS             │ │
│ │ ┌──────────────────────────┐ │ Zone: Plot 1 East       │ │
│ │ │  ┌─────────┐ ┌─────────┐ │ │ Status: Irrigated ✓     │ │
│ │ │  │ P1E ╱╱╱ │ │ P2E     │ │ │ Crop: Coconut           │ │
│ │ │  │NM ╱╱╱   │ │         │ │ │ Trees: 125              │ │
│ │ │  ├─────────┤ ├─────────┤ │ │ Runtime: 3h 30m         │ │
│ │ │  │ P1W     │ │ P2W ╱╱╱ │ │ │ Water: 1,75,000 L      │ │
│ │ │  │         │ │NM ╱╱╱   │ │ │ Per Tree: 1,400 L       │ │
│ │ │  ├─────────┤ ├─────────┤ │ │                         │ │
│ │ │  │  Jackfruit  │         │ │ Last Irrigation:        │ │
│ │ │  │             │         │ │ 2026-07-16 @ 06:30     │ │
│ │ │  └─────────────┘         │ │                         │ │
│ │ └──────────────────────────┘ │                         │ │
│ │ Green=Irrig | Hatched=Nutmeg│ └─────────────────────────┘ │
│ └──────────────────────────────┘                             │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ OPERATIONAL ALERTS:                                         │
│ ⚠ P2E — No irrigation record for selected date              │
│ ⚠ JF — Partial irrigation record (2 records)                │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ CHARTS (2x2 grid):                                          │
│ ┌──────────────────────────┬──────────────────────────┐    │
│ │ Runtime by Zone (Bar)    │ Water by Zone (Bar)      │    │
│ │  3h ┌────┐              │ 200k ┌────┐              │    │
│ │  2h │    │┌────┐┌────┐ │ 150k │    │┌────┐┌────┐ │    │
│ │  1h │    ││    ││    │ │ 100k │    ││    ││    │ │    │
│ │     │    ││    ││    │ │  50k │    ││    ││    │ │    │
│ │     P1E P1W P2E P2W JF NM  │     P1E P1W P2E P2W JF NM  │    │
│ └──────────────────────────┴──────────────────────────┘    │
│ ┌──────────────────────────┬──────────────────────────┐    │
│ │ Water per Tree (Line)    │ Activity Distribution   │    │
│ │  2000 ╱╲               │          ◯               │    │
│ │  1500╱  ╲╱─────        │      ╱      ╲            │    │
│ │  1000─────────         │    ╱  P1E    ╲          │    │
│ │   500 ─────            │   │ 35% P1W  │ NM        │    │
│ │        06:30 09:00 11:30   │ 20%   25% │ 10%      │    │
│ │        P1E   P1W   P2E     ╲        ╱            │    │
│ └──────────────────────────┴──────────────────────────┘    │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ DETAILED RECORDS:                                           │
│ Zone Filter: [All Zones ▼]  12 records                      │
│ ┌─────┬──────┬─────┬───────┬──────┬─────────┬─────────────┐ │
│ │Date │Time  │Zone │Motor  │Valve │Runtime  │Water        │ │
│ ├─────┼──────┼─────┼───────┼──────┼─────────┼─────────────┤ │
│ │07/16│06:30 │P1E  │M1     │V1    │ 3h 30m  │ 1,75,000 L  │ │
│ │07/16│06:45 │NM   │M2     │V2    │ 3h 00m  │ 1,50,000 L  │ │
│ │07/16│09:00 │P1W  │M1     │V3    │ 3h 20m  │ 1,66,667 L  │ │
│ │...  │...   │...  │...    │...   │...      │...          │ │
│ └─────┴──────┴─────┴───────┴──────┴─────────┴─────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Zone Status Card Detail

### Active (Irrigated)
```
┌────────────────────┐
│ P1E                │  ✓ Selectable, highlights
│ Plot 1 East        │    when clicked or map
│ [✓ Irrigated]      │    selected
├────────────────────┤
│ Motor: M1          │  Shows all key info
│ Valve: V1          │  compact
│ Runtime: 3h 30m    │
│ Water: 1,75,000 L  │
│ Per Tree: 1,400 L  │
│ Time: 06:30        │
└────────────────────┘
```

### No Record
```
┌────────────────────┐
│ P2E                │  Gray styling indicates
│ Plot 2 East        │  no irrigation today
│ [— No Record]      │
├────────────────────┤
│ Motor: M3          │  Still shows zone info
│ Valve: V4          │  but grayed out
│ (No irrigation)    │
└────────────────────┘
```

### Nutmeg (Special)
```
┌────────────────────┐
│ NM                 │  Orange styling for
│ Nutmeg             │  operational overlay
│ [✓ Irrigated]      │
├────────────────────┤
│ Overlaps           │  Overlap info visible
│ P1E and P2W        │  on card
│ Motor: M2          │
│ Valve: V2          │
│ Runtime: 3h 00m    │
│ Water: 1,50,000 L  │
│ Per Tree: 2,857 L  │  Uses fixed 80L rate
│ Time: 06:45        │
└────────────────────┘
```

---

## Map Visualization

### Basic Map (SVG)
```
┌─────────────────────────────────────┐
│                                     │
│    ┌─────────┐    ┌─────────┐     │
│    │ PLOT 1  │    │ PLOT 2  │     │
│    │  EAST   │    │  EAST   │     │
│    └─────────┘    └─────────┘     │
│                                     │
│    ┌─────────┐    ┌─────────┐     │
│    │ PLOT 1  │    │ PLOT 2  │     │
│    │  WEST   │    │  WEST   │     │
│    └─────────┘    └─────────┘     │
│                                     │
│       ┌──────────────┐             │
│       │  JACKFRUIT   │             │
│       └──────────────┘             │
│                                     │
└─────────────────────────────────────┘
```

### With Nutmeg Overlay
```
┌─────────────────────────────────────┐
│                                     │
│    ┌─────────┐    ┌─────────┐     │
│    │ P1E ╱╱╱ │    │ P2E     │     │
│    │NM ╱╱╱   │    │         │     │
│    └─────────┘    └─────────┘     │
│                                     │
│    ┌─────────┐    ┌─────────┐     │
│    │ P1W     │    │ P2W ╱╱╱ │     │
│    │         │    │NM ╱╱╱   │     │
│    └─────────┘    └─────────┘     │
│                                     │
│       ┌──────────────┐             │
│       │  JACKFRUIT   │             │
│       └──────────────┘             │
│                                     │
│ ╱╱╱ = Nutmeg Overlay (Hatched)    │
│ ─ ─ = Hatched Border              │
└─────────────────────────────────────┘
```

---

## Color Reference

### Status Colors
- **Green (#10b981)**: Irrigated zone
- **Gray (#d1d5db)**: No irrigation record
- **Amber (#f59e0b)**: Partial/Multiple records
- **Red (#ef4444)**: Issue/Alert (reserved)

### Zone Colors (Charts)
```
P1E: ███ Green      (#10b981)
P1W: ███ Dark Green (#059669)
P2E: ███ Light Green (#34d399)
P2W: ███ Teal       (#6ee7b7)
JF:  ███ Amber      (#fbbf24)
NM:  ███ Orange     (#d97706)
```

### UI Elements
- **Primary**: Green (MFMS style)
- **Secondary**: Blue (water info)
- **Warning**: Amber/Orange
- **Backgrounds**: Light gray/white
- **Borders**: Light gray/subtle
- **Text**: Dark gray (foreground)

---

## Responsive Layouts

### Mobile (<768px)
```
┌─────────────────────┐
│ [HEADER]            │
├─────────────────────┤
│ IRRIGATION MGMT     │
├─────────────────────┤
│ [Period Selector]   │
├─────────────────────┤
│ [Summary Card 1]    │
│ [Summary Card 2]    │
│ [Summary Card 3]    │
│ [Summary Card 4]    │
│ [Summary Card 5]    │
├─────────────────────┤
│ [Zone Cards 2 cols] │
├─────────────────────┤
│ [MAP - Full Width]  │
│ ┌─────────────────┐ │
│ │ (Scrollable)    │ │
│ └─────────────────┘ │
├─────────────────────┤
│ [Detail Panel]      │
├─────────────────────┤
│ [Alerts]            │
├─────────────────────┤
│ [Chart 1 - Full]    │
│ [Chart 2 - Full]    │
│ [Chart 3 - Full]    │
│ [Chart 4 - Full]    │
├─────────────────────┤
│ [Table - Scroll]    │
└─────────────────────┘
```

### Tablet (768px - 1199px)
```
┌────────────────────────────────────┐
│ [HEADER]                           │
├────────────────────────────────────┤
│ [Period] [Summary Cards - Wrap]    │
├────────────────────────────────────┤
│ [Zone Cards - 3 cols]              │
├────────────────────────────────────┤
│ [MAP - Full]                       │
│ [Detail Panel - Below]             │
├────────────────────────────────────┤
│ [Alerts]                           │
├────────────────────────────────────┤
│ [Chart 1] [Chart 2]                │
│ [Chart 3] [Chart 4]                │
├────────────────────────────────────┤
│ [Table - Scrollable]               │
└────────────────────────────────────┘
```

### Desktop (1200px+)
```
┌─────────────────────────────────────────┐
│ [HEADER]                                │
├─────────────────────────────────────────┤
│ [Period] [Summary Cards - 5 cols]       │
├─────────────────────────────────────────┤
│ [Zone Cards - 6 cols]                   │
├─────────────────────────────────────────┤
│ [MAP 2/3] [Detail Panel 1/3]            │
├─────────────────────────────────────────┤
│ [Alerts]                                │
├─────────────────────────────────────────┤
│ [Chart 1] [Chart 2]                     │
│ [Chart 3] [Chart 4]                     │
├─────────────────────────────────────────┤
│ [Table - Full Width, Scroll H]          │
└─────────────────────────────────────────┘
```

---

## Zone Details Panel

### Example: P1E Selected
```
┌─────────────────────────────┐
│ ZONE DETAILS                │
├─────────────────────────────┤
│ Zone                        │
│ Plot 1 East                 │
│ P1E                         │
├─────────────────────────────┤
│ Crop:      Coconut          │
│ Trees:     125              │
│ Status:    Irrigated ✓      │
│ Records:   1                │
├─────────────────────────────┤
│ Runtime:        3h 30m      │
│ Water Pumped:   1,75,000 L  │
│ Per Tree:       1,400 L     │
├─────────────────────────────┤
│ Last Irrigation             │
│ 2026-07-16 at 06:30        │
└─────────────────────────────┘
```

### Example: Nutmeg Selected
```
┌─────────────────────────────┐
│ ZONE DETAILS                │
├─────────────────────────────┤
│ Zone                        │
│ Nutmeg                      │
│ NM                          │
├─────────────────────────────┤
│ ⚠ Operational overlay       │
│ spanning P1E and P2W        │
├─────────────────────────────┤
│ Crop:      Nutmeg           │
│ Trees:     35               │
│ Status:    Irrigated ✓      │
│ Records:   1                │
├─────────────────────────────┤
│ Runtime:        3h 00m      │
│ Water Pumped:   1,50,000 L  │
│ Per Tree:       4,286 L     │ ← Fixed 80/hr rate
├─────────────────────────────┤
│ Last Irrigation             │
│ 2026-07-16 at 06:45        │
└─────────────────────────────┘
```

---

## Table View

### Headers (Sortable)
```
Date | Time | Zone | Motor | Valve | Runtime ▲ | Water | Per Tree | Crop | Trees | Remarks
```

### Sample Rows
```
2026-07-16 | 06:30 | P1E | M1 | V1 | 3h 30m | 1,75,000 L | 1,400 L | Coconut | 125 | Regular cycle
2026-07-16 | 06:45 | NM  | M2 | V2 | 3h 00m | 1,50,000 L | 4,286 L | Nutmeg  | 35  | Independent op
2026-07-16 | 09:00 | P1W | M1 | V3 | 3h 20m | 1,66,667 L | 1,515 L | Coconut | 110 | Plot 1 West
```

---

## Chart Examples

### Runtime by Zone (Bar Chart)
```
        Runtime (hours)
5       ┌────┐
4       │    │
3       │    │┌────┐┌────┐
2       │    ││    ││    │
1       │    ││    ││    │
0       └────┘└────┘└────┘┌────┐┌────┐
        P1E  P1W  P2E  P2W  JF   NM
```

### Water per Tree (Line Chart)
```
        Water/Tree (L)
5000    ┌─╱─────╲
4000    │╱       ╲┌────
3000    ╱─────────╱    ╲
2000   ╱                ╲╱────
1000  ╱
      06:30 09:00 12:00 15:00
      P1E   P1W   P2E   JF  NM
```

### Activity Distribution (Pie)
```
          NM
         10%
    ┌────────────┐
   │ ╱ P1E 35% ╲  │
  │  │           │  │
 │    P1W      NM   │
│     20%     10%    │
│            Jackf. │
 │      JF    12%   │
  │    12%          │
   │ ╲ P2E 11% ╱   │
    └────────────┘
```

---

## Alert Strip Examples

### No Alerts (All irrigated today)
```
[No operational alerts]
```

### Missing Records
```
⚠ P2E — No irrigation record for selected date
⚠ JF  — No irrigation record for selected date
```

### Partial Records
```
⚠ P1E — Partial irrigation record (2 records)
⚠ NM  — Partial irrigation record (3 records)
```

### Mixed
```
⚠ P2E — No irrigation record for selected date
⚠ P1E — Partial irrigation record (2 records)
✓ P1W — Irrigation completed
✓ NM  — Irrigation completed
```

---

## User Interactions

### Zone Selection Flow
```
User clicks Zone Card → Card highlights → Map updates
                                      → Detail panel updates

User clicks Map Area → Zone card highlights → Detail panel updates
                    → Map zone highlights
```

### Date Selection Flow
```
User clicks "Today" → Date updates → All data refreshes
                   → Zone selection preserved
                   → Table/Charts update
```

### Table Filtering Flow
```
User selects Zone Filter → Table immediately filters → Shows X records
                        → Maintains current sort
                        → Count updates
```

---

## Visual Hierarchy

### Most Important (1st glance)
1. Zone status cards (all 6 visible at once)
2. Map with color-coded zones
3. Summary statistics

### Important (2nd glance)
4. Detail panel (updates on zone click)
5. Operational alerts (if any)
6. Charts

### Reference (3rd glance)
7. Records table
8. Period selector
9. Refresh/Export buttons

---

This visual guide reflects the exact layout and interaction patterns implemented in the hybrid dashboard.
