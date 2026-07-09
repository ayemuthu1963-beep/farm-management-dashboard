# Muthu Farms Digital Farm Management System — Frontend

This is a **Next.js (App Router) + React + TypeScript + Tailwind CSS** project.

The UI was designed in **v0** and is **visually approved**. **The design is frozen.**
Data is currently **mock JSON only** — there is no backend, API, or database wired up yet.

> The purpose of this repo is the approved visual front end. A separate step (Codex)
> connects the real farm database/API **without changing the approved UI**.

---

## Tech stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS (theme tokens in `app/globals.css`)
- `recharts` for charts
- `lucide-react` for icons

---

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000

---

## Routes

| Route                    | File                                | Status            |
| ------------------------ | ----------------------------------- | ----------------- |
| `/`                      | `app/page.tsx`                      | Home (approved)   |
| `/coconut-harvest`       | `app/coconut-harvest/page.tsx`      | Hub — 4 view cards |
| `/coconut-harvest/tree-view`        | `app/coconut-harvest/tree-view/page.tsx`        | Per-tree harvest history |
| `/coconut-harvest/cycle-view`       | `app/coconut-harvest/cycle-view/page.tsx`       | Cycle & date-range summary |
| `/coconut-harvest/tree-performance` | `app/coconut-harvest/tree-performance/page.tsx` | Plot 1 & Plot 2 classification |
| `/coconut-harvest/detailed-query`   | `app/coconut-harvest/detailed-query/page.tsx`   | Multi-filter search form |
| `/jackfruit-monitoring`  | `app/jackfruit-monitoring/page.tsx` | Approved          |
| `/well-water`            | `app/well-water/page.tsx`           | Approved          |
| `/motor-runtime`         | `app/motor-runtime/page.tsx`        | Approved          |
| `/beetle-trap`           | `app/beetle-trap/page.tsx`          | Approved          |
| `/pipeline-layout`       | `app/pipeline-layout/page.tsx`      | Approved          |
| `/fertiliser-management` | `app/fertiliser-management/page.tsx`| Approved          |
| `/under-construction`    | `app/under-construction/page.tsx`   | Placeholder for the 4 future modules (Weather History, Farm Reports, Worker Management, Inventory Management) |

**Preserve all existing routes.**

---

## Data structure (mock JSON — one data file per page)

All page data lives in `lib/`. Components read from these files and do **not** hardcode data.
There is **one data file per page**:

- **Home page:** `lib/home-data.ts`
  - `weatherData: WeatherData` — the summary values shown on the weather card
  - `moduleCards: ModuleCardData[]` — the 11 module launcher cards (order is frozen)
- **Coconut Harvest (all 5 pages share one file):** `lib/coconut-harvest-data.ts`
  - `treeNumbers`, `harvestCycleOptions`, `treeClassifications` — dropdown option lists
  - `treeHarvestHistory` — Tree View per-tree history rows
  - `cycleSummary`, `harvestCycleRows` — Cycle & Harvest View summary + table
  - `plot1Performance`, `plot2Performance`, `performanceCyclesUsed` — Tree Performance bands
  - `formatRupees()` — helper that formats numbers with Indian digit grouping (money is stored as plain numbers)
  - Currently **mock JSON only** — Codex will connect the real harvest database/API later, keeping the same shapes. Export to Excel is **visual only**.
- **Jackfruit Monitoring:** `lib/jackfruit-data.ts`
  - `jackfruitSummary`, `jackfruitTrees`, `stageDistribution`
- **Well Water:** `lib/well-data.ts`
  - `wellCapacity`, `northWellRecords`, `southWellRecords`, `summaryStats`, `seriesConfig`, `toChartData()`
  - Water figures are in **Litres**. Calculation rules for the backend are documented at the top of the file.
- **Motor Runtime:** `lib/motor-data.ts`
  - `motorInfo`, `motorStatuses`, `m1Records`/`m2Records`/`m3Records`, `motorSummaryStats`, `motorSeriesConfig`, `toRuntimeChartData()`, `valveGroups`
- **Beetle Trap:** `lib/beetle-data.ts`
  - `beetleSummary` — the 6 top summary cards
  - `traps` — single source of truth for all traps (plot, `x`/`y` map %, `lastCount`, `cumulativeCount`, `risk`, type); `topTraps` is derived (highest cumulative first)
  - `dailyCounts` — last 15 inspection dates, **Rhinoceros vs Red Palm Weevil kept separate (no totals)**; rendered as a line chart
  - `areaInfections`, `resetSchedule`, `plotMaps`, `countBands` + `bandForCount()` (icon-size band from cumulative count)
  - **Placeholder map only** — Codex connects `plot1.mbtiles`/`plot2.mbtiles`, `Beetle_Traps.geojson`, and the beetle SVG icons later. `x`/`y` are placeholder positions to be replaced by real GPS coords.
- **Pipeline Layout & Inspection:** `lib/pipeline-data.ts`
  - `pipelineSummary`, `pipelineSegments`, `pipelineIssues`
- **Fertiliser Management:** `lib/fertiliser-data.ts`
  - `fertiliserSummary`, `fertiliserSchedule`, `stockItems`, `usageTrend`

### TypeScript types (already defined — keep these shapes)

Keeping the same shapes lets real data drop in without touching UI components:

- `lib/home-data.ts`: `WeatherData`, `ModuleCardData`
- `lib/coconut-harvest-data.ts`: `TreeHarvestRow`, `CycleSummary`, `HarvestCycleRow`, `CycleStatus`, `PerformanceRow`
- `lib/jackfruit-data.ts`: `JackfruitSummary`, `RipenessStage`, `JackfruitTree`, `StageDistribution`
- `lib/well-data.ts`: `WellId`, `WellDailyRecord`, `SummaryStat`, `ChartPoint`
- `lib/motor-data.ts`: `MotorId`, `MotorInfo`, `MotorDailyRecord`, `MotorStatus`, `MotorSummaryStat`, `MotorChartPoint`, `ValveRecord`, `ValveGroup`
- `lib/beetle-data.ts`: `PlotId`, `BeetleType`, `RiskLevel`, `CountBand`, `BeetleSummary`, `Trap`, `DailyCount`, `AreaInfection`, `PlotMap`, `CountBandInfo`
- `lib/pipeline-data.ts`: `PipelineSummary`, `SegmentStatus`, `PipelineSegment`, `IssueSeverity`, `PipelineIssue`
- `lib/fertiliser-data.ts`: `FertiliserSummary`, `ScheduleStatus`, `FertiliserSchedule`, `StockLevel`, `StockItem`, `UsagePoint`

---

## Components

Reusable components are grouped by area:

- `components/home/` — home page: `home-header.tsx`, `weather-card.tsx`, `module-card.tsx`, `home-footer.tsx`
- `components/farm/` — shared building blocks used by every dashboard page:
  `dashboard-shell.tsx`, `sidebar.tsx`, `header.tsx`, `panel.tsx` (supports an optional `headerRight` slot),
  `date-range-selector.tsx`, `stat-card.tsx` (`StatCard` + `StatGrid`), `export-button.tsx` (visual only),
  plus Well Water: `well-table.tsx`, `well-chart.tsx`, `well-section.tsx`, `summary-cards.tsx`
- `components/motor/` — Motor Runtime: `motor-status-cards.tsx`, `motor-table.tsx`, `motor-chart.tsx`, `motor-log-section.tsx`, `motor-valves-section.tsx`, `motor-summary-cards.tsx`
- `components/coconut/` — Coconut Harvest: `harvest-hub-card.tsx` (landing cards), `coconut-subheader.tsx` (breadcrumb + title + Back + Export)
- `components/jackfruit/` — `jackfruit-chart.tsx`
- `components/beetle/` — Beetle Trap: `beetle-map-section.tsx` (client: plot tabs, orthomosaic + count-scaled markers, legend, selected-trap panel, Top 10 table with a "Show all traps" toggle), `beetle-daily-chart.tsx` (line chart, 15 dates, separate counts)
- `components/fertiliser/` — `fertiliser-chart.tsx`
- `components/ui/` — shadcn/ui primitives

> The `ExportButton` is intentionally **visual only** (no export logic). Codex can wire up real
> Excel/CSV export later.

---

## Assets

Approved images live under `public/`:

```
public/mfms/
  logo/    muthu-farms-drone-tablet-logo.png   (home header logo)
  header/  coconut-plantation-bg.png           (home header background)
  icons/   coconut-harvest.png, jackfruit-monitoring.png, well-water-level.png,
           motor-runtime.png, beetle-trap-monitoring.png,
           pipeline-layout-inspection.png, fertiliser-management.png,
           todays-weather.png, weather-history.png, farm-reports.png,
           worker-management.png, inventory-management.png
  beetle/  plot1-orthomosaic.png, plot2-orthomosaic.png
           (PLACEHOLDER drone maps — Codex replaces with real plot1/plot2.mbtiles tiles)
public/
  farm-banner.png          (Well Water / Motor Runtime header banner)
  muthu-farms-logo.png     (Well Water / Motor Runtime header logo)
```

**Do not rename assets unless all references are updated.**

---

## Instructions for Codex (data connection)

1. **Do not redesign the UI.**
2. **Do not** alter the approved visual layout.
3. **Do not** alter Tailwind styling unless absolutely necessary.
4. **Do not** change colours, spacing, shadows, border radius, typography, card layout, or header.
5. Connect real data by updating **data / API files only**.
6. Prefer replacing the mock data exports in `lib/*-data.ts`.
7. If required, create helper API files (do not put fetch logic in components):
   - `lib/api.ts`
   - `lib/weather-api.ts`
   - `lib/well-api.ts`
   - `lib/motor-api.ts`
8. Keep the same TypeScript data shapes wherever possible so UI components do not need to change.
9. **Preserve all existing routes.**
10. Before saying done, **run the app and show a browser screenshot.**
11. **Confirm the visual design still matches the approved v0 design** after the data connection.

See `CODEX_HANDOFF.md` for the short, practical checklist.
