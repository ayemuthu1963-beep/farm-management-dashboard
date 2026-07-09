# Codex Handoff Instructions

This project is an **approved v0-generated MFMS frontend** (Next.js App Router +
React + TypeScript + Tailwind CSS). The visual UI is **frozen and approved**.

## Task for Codex

Connect real backend/API data **without changing the approved UI**.

## Rules

- First run the project **exactly as received** (`npm install` && `npm run dev`).
- Take a **screenshot of the static UI before** making any changes.
- Do **not** change visual components unless unavoidable.
- Do **not** change the global theme (`app/globals.css`).
- Do **not** change page layout.
- Do **not** remove icons/assets.
- Do **not** replace the header.
- Do **not** change responsive grid behaviour.
- **Keep mock data as a fallback if the API fails.**
- Add API service files **only where needed**.
- Keep all backend/API work **isolated in `lib/`** or dedicated service files.
- After connecting data, **run the app again and show a screenshot.**
- If data connection breaks the layout, **fix the data mapping, not the UI design.**

## What you MAY change

- The data exports inside `lib/home-data.ts`, `lib/well-data.ts`, `lib/motor-data.ts`
  (swap mock values for real fetched data, keep the same TypeScript shapes).
- Server/client fetching logic **only where required** to feed those data files.
- New API service files (see below).

## What you must NOT change (frozen)

layout · spacing · card size · colours · typography · header design · icons ·
shadows · border radius · responsive behaviour · component visual structure.

## Suggested API service structure

```
lib/api.ts             Common fetch helper (base URL, error handling, JSON parsing)
lib/weather-api.ts     Weather / Ambient Weather integration
lib/coconut-api.ts     Coconut Harvest data integration
lib/jackfruit-api.ts   Jackfruit Monitoring data integration
lib/well-api.ts        Well Water data integration
lib/motor-api.ts       Motor Runtime data integration
lib/beetle-api.ts      Beetle Trap data integration
lib/pipeline-api.ts    Pipeline Inspection data integration
lib/fertiliser-api.ts  Fertiliser Management data integration
```

## Mock data files (one per page — may remain as fallback)

```
lib/home-data.ts             WeatherData, ModuleCardData
lib/coconut-harvest-data.ts  TreeHarvestRow, CycleSummary, HarvestCycleRow, PerformanceRow, ...
                             (one file shared by all 5 Coconut Harvest pages:
                              /coconut-harvest, /tree-view, /cycle-view,
                              /tree-performance, /detailed-query — mock JSON only,
                              Export to Excel is visual only)
lib/jackfruit-data.ts   JackfruitSummary, JackfruitTree, StageDistribution, ...
lib/well-data.ts        WellDailyRecord, SummaryStat, ChartPoint, wellCapacity, ...  (figures in Litres)
lib/motor-data.ts       MotorInfo, MotorDailyRecord, MotorStatus, ValveGroup, ...
lib/beetle-data.ts      BeetleSummary, Trap (single source; topTraps derived,
                        Top 10 table has a "Show all traps" toggle),
                        DailyCount (last 15 inspection dates, LINE chart,
                        rhino/weevil kept separate, no totals),
                        AreaInfection, PlotMap, CountBandInfo, resetSchedule, ...
                        MAP IS PLACEHOLDER: connect plot1.mbtiles / plot2.mbtiles
                        (drone orthomosaics), Beetle_Traps.geojson (trap GPS + type),
                        red_palm_weevil_red.svg + rhinoceros_beetle_black.svg (marker
                        icons). Trap x/y are placeholder % positions -> real GPS.
                        Recommended: PMTiles + MapLibre GL JS served statically.
lib/pipeline-data.ts    PipelineSummary, PipelineSegment, PipelineIssue, ...
lib/fertiliser-data.ts  FertiliserSummary, FertiliserSchedule, StockItem, UsagePoint, ...
```

### Well Water calculation rules (for the backend)

```
North Well: 1 inch = 1,650 litres
South Well: 1 inch = 1,300 litres
Pumped Out  = Morning reading - Evening reading
Recharged   = Evening reading - Next Morning reading
```

## Recommended pattern

Fetch in a Server Component / route and map the response into the **existing
exported types**, then pass it to the same UI components. Example shape to preserve:

```ts
// lib/well-api.ts
import type { WellDailyRecord } from "@/lib/well-data"

export async function getNorthWellRecords(): Promise<WellDailyRecord[]> {
  // fetch from real API, map to WellDailyRecord[], return
  // on failure, return the mock northWellRecords as fallback
}
```

Because the UI components only depend on these types, connecting real data should
require **zero visual changes**.

## Definition of done

1. App runs with real data.
2. Mock fallback still works if the API is unavailable.
3. Screenshot proves the UI is visually identical to the approved v0 design.
