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

| Route               | File                          | Status            |
| ------------------- | ----------------------------- | ----------------- |
| `/`                 | `app/page.tsx`                | Home (approved)   |
| `/well-water`       | `app/well-water/page.tsx`     | Approved          |
| `/motor-runtime`    | `app/motor-runtime/page.tsx`  | Approved          |
| `/under-construction` | `app/under-construction/page.tsx` | Placeholder for future modules |

**Preserve all existing routes.**

---

## Data structure (mock JSON — one data file per page)

All page data lives in `lib/`. Components read from these files and do **not** hardcode data.

- **Home page data:** `lib/home-data.ts`
  - `weatherData: WeatherData` — the summary values shown on the weather card
  - `moduleCards: ModuleCardData[]` — the module launcher cards (order is frozen)
- **Well Water page data:** `lib/well-data.ts`
  - `wellInfo`, `northWellRecords`, `southWellRecords`, `summaryStats`, `seriesConfig`, `toChartData()`
- **Motor Runtime page data:** `lib/motor-data.ts`
  - `motorInfo`, `motorStatuses`, `m1Records`/`m2Records`/`m3Records`, `motorSummaryStats`, `motorSeriesConfig`, `toRuntimeChartData()`

### TypeScript types (already defined — keep these shapes)

Keeping the same shapes lets real data drop in without touching UI components:

- `lib/home-data.ts`: `WeatherData`, `ModuleCardData`
- `lib/well-data.ts`: `WellId`, `WellDailyRecord`, `MotorRecord`, `WellInfo`, `SummaryStat`, `ChartPoint`
- `lib/motor-data.ts`: `MotorId`, `MotorInfo`, `MotorDailyRecord`, `MotorStatus`, `MotorSummaryStat`, `MotorChartPoint`

---

## Components

Reusable components are grouped by area:

- `components/home/` — home page: `home-header.tsx`, `weather-card.tsx`, `module-card.tsx`, `home-footer.tsx`
- `components/farm/` — shared dashboard shell + Well Water: `dashboard-shell.tsx`, `sidebar.tsx`, `header.tsx`, `panel.tsx`, `date-range-selector.tsx`, `well-table.tsx`, `well-chart.tsx`, `well-section.tsx`, `well-motor-info.tsx`, `summary-cards.tsx`
- `components/motor/` — Motor Runtime: `motor-status-cards.tsx`, `motor-info.tsx`, `motor-table.tsx`, `motor-chart.tsx`, `motor-log-section.tsx`, `motor-summary-cards.tsx`
- `components/ui/` — shadcn/ui primitives

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
           todays-weather.png
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
