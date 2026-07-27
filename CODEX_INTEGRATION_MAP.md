# CODEX Integration Map - Coconut Counting Approved UI

**Status:** Static UI Handover Ready  
**Date:** July 27, 2026  
**UI Branch:** v0/coconut-counting-mobile-redesign  
**Viewport:** 412 × 915 px (Android Mobile Portrait)

---

## Component Structure

```
app/coconut-counting-redesign/page.tsx
├── CoconutHeader
├── CountTile (4× instances: A1, B1, A2, B2)
├── ABCounterRow (A counter, B counter)
├── TotalTiles (Total A, Total B, Total A+B)
├── LowerPanel (Total nuts Harvested)
├── A1B1B2CounterRow (A1 counter, B1 counter, B2 counter)
└── ActionButtons (History, Date, Reset)
```

---

## Field-by-Field Integration Map

### SEND Action Tiles (Fixed Count)

| UI Element | Label | Type | APK Binding | Notes |
|-----------|-------|------|-----------|-------|
| Grade A — 200 (A1) | GRADE A — 200 (A1) | Fixed Count Button | Existing A1 SEND action | Count fixed at 200 |
| Grade B — 200 (B1) | GRADE B — 200 (B1) | Fixed Count Button | Existing B1 SEND action | Count fixed at 200 |

**Component:** `CountTile` with `variant="fixed"`

---

### Manual Pair Entry Tiles

| UI Element | Label | Type | APK Binding | Notes |
|-----------|-------|------|-----------|-------|
| Grade A — 1 TO 99 PAIRS (A2) | GRADE A — 1 TO 99 PAIRS (A2) | Input (1-99) + SEND | Existing A2 entry logic | User-editable integer field |
| Grade B — 1 TO 99 PAIRS (B2) | GRADE B — 1 TO 99 PAIRS (B2) | Input (1-99) + SEND | Existing B2 entry logic | User-editable integer field |

**Component:** `CountTile` with `variant="manual"`

---

### Calculated Summary Counters (Read-Only)

| UI Element | Label | Type | APK Binding | Value Source |
|-----------|-------|------|-----------|--------------|
| A counter | A counter | Display | Existing APK calculation | Sum of all A entries |
| B counter | B counter | Display | Existing APK calculation | Sum of all B entries |

**Component:** `ABCounterRow`

---

### Calculated Totals Row (Read-Only)

| UI Element | Label | Type | APK Binding | Value Source |
|-----------|-------|------|-----------|--------------|
| TOTAL A | TOTAL A | Display | Existing APK calculation | Total A value |
| TOTAL B | TOTAL B | Display | Existing APK calculation | Total B value |
| TOTAL A+B | TOTAL A+B | Display | Existing APK calculation | Sum of Total A + Total B |

**Component:** `TotalTiles`

---

### Primary Editable Field

| UI Element | Label | Type | APK Binding | Notes |
|-----------|-------|------|-----------|-------|
| Total nuts Harvested | Total nuts Harvested | Input (numeric) | Existing primary field | Full-width green gradient panel |

**Component:** `LowerPanel`

---

### Calculated Counter Details (Read-Only)

| UI Element | Label | Type | APK Binding | Value Source |
|-----------|-------|------|-----------|--------------|
| A1 counter | A1 counter | Display | Existing APK calculation | A1 calculated value |
| B1 counter | B1 counter | Display | Existing APK calculation | B1 calculated value |
| B2 counter | B2 counter | Display | Existing APK calculation | B2 calculated value |

**Component:** `A1B1B2CounterRow`

---

### Action Buttons

| UI Element | Label | Type | APK Binding | Notes |
|-----------|-------|------|-----------|-------|
| History | HISTORY | Button | Existing History action | Green/teal button |
| Date | DATE | Button | Existing Date action | Teal/blue button |
| Reset | RESET | Button | Existing Reset action | Orange button |

**Component:** `ActionButtons`

---

## Implementation Guidelines

### Do Not Change

- Layout order (header → tiles → counters → totals → input → details → buttons)
- Color scheme (green/blue/teal for data, orange for reset)
- Border styling (no red borders except for validation errors in future)
- Typography sizing and weights
- Mobile viewport arrangement (412×915 px)
- Mock data in static prototype

### Codex Must Implement

1. **Connect Input Fields to APK Data**
   - A2 pair entry → existing A2 calculation
   - B2 pair entry → existing B2 calculation
   - Total nuts Harvested → existing primary field

2. **Bind Display Fields to APK Calculations**
   - A counter ← existing total A calculation
   - B counter ← existing total B calculation
   - TOTAL A ← existing Total A value
   - TOTAL B ← existing Total B value
   - TOTAL A+B ← sum calculation
   - A1 counter ← existing A1 detail
   - B1 counter ← existing B1 detail
   - B2 counter ← existing B2 detail

3. **Wire Action Buttons**
   - History SEND → existing History logic
   - Date SEND → existing Date picker/action
   - Reset SEND → existing Reset action

4. **Replace Mock Data**
   - Remove hardcoded `mockData` object
   - Fetch from APK state/database
   - Update on field changes

---

## Build & Deployment

**Production Build Status:** ✓ Success (28/28 pages generated)

**Next Steps:**
1. Copy component files to Codex repository
2. Replace mock data with APK state bindings
3. Connect input onChange handlers to APK logic
4. Bind display values to APK calculations
5. Wire button actions to APK methods
6. Test on Android 412×915 px viewport
7. Validate all calculations match APK logic

---

## Important Notes

- **Existing APK Business Logic is Authoritative** — Do not rewrite calculations
- **Static UI Only** — This package contains no business logic, only presentation
- **No New Formulas** — All calculations already exist in the working APK
- **Color Scheme is Frozen** — No red borders except for validation errors in future
- **Mobile Viewport is Optimized** — Content height 942px, 27px scroll required (acceptable)

---

**Prepared:** v0 (July 27, 2026)  
**Contact:** Codex Integration Team
