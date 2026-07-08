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
| `/coconut-harvest`       | `app/coconut-harvest/page.tsx`      | Approved          |
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
- **Coconut Harvest:** `lib/coconut-data.ts`
  - `coconutSummary`, `harvestCycles`, `treePerformance`, `recentHarvest`, `coconutTrend`
- **Jackfruit Monitoring:** `lib/jackfruit-data.ts`
  - `jackfruitSummary`, `jackfruitTrees`, `stageDistribution`
- **Well Water:** `lib/well-data.ts`
  - `wellCapacity`, `northWellRecords`, `southWellRecords`, `summaryStats`, `seriesConfig`, `toChartData()`
  - Water figures are in **Litres**. Calculation rules for the backend are documented at the top of the file.
- **Motor Runtime:** `lib/motor-data.ts`
  - `motorInfo`, `motorStatuses`, `m1Records`/`m2Records`/`m3Records`, `motorSummaryStats`, `motorSeriesConfig`, `toRuntimeChartData()`, `valveGroups`
- **Beetle Trap:** `lib/beetle-data.ts`
  - `beetleSummary`, `trapRecords`, `beetleTrend`
- **Pipeline Layout & Inspection:** `lib/pipeline-data.ts`
  - `pipelineSummary`, `pipelineSegments`, `pipelineIssues`
- **Fertiliser Management:** `lib/fertiliser-data.ts`
  - `fertiliserSummary`, `fertiliserSchedule`, `stockItems`, `usageTrend`

### TypeScript types (already defined — keep these shapes)

Keeping the same shapes lets real data drop in without touching UI components:

- `lib/home-data.ts`: `WeatherData`, `ModuleCardData`
- `lib/coconut-data.ts`: `CoconutSummary`, `HarvestCycle`, `TreePerformance`, `HarvestRecord`, `CoconutTrendPoint`
- `lib/jackfruit-data.ts`: `JackfruitSummary`, `RipenessStage`, `JackfruitTree`, `StageDistribution`
- `lib/well-data.ts`: `WellId`, `WellDailyRecord`, `SummaryStat`, `ChartPoint`
- `lib/motor-data.ts`: `MotorId`, `MotorInfo`, `MotorDailyRecord`, `MotorStatus`, `MotorSummaryStat`, `MotorChartPoint`, `ValveRecord`, `ValveGroup`
- `lib/beetle-data.ts`: `BeetleSummary`, `TrapStatus`, `TrapRecord`, `BeetleTrendPoint`
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
- `components/coconut/` — `coconut-chart.tsx`
- `components/jackfruit/` — `jackfruit-chart.tsx`
- `components/beetle/` — `beetle-chart.tsx`
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
