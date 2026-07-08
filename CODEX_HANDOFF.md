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
lib/api.ts          Common fetch helper (base URL, error handling, JSON parsing)
lib/weather-api.ts  Weather / Ambient Weather integration
lib/well-api.ts     Well Water data integration
lib/motor-api.ts    Motor Runtime data integration
```

## Mock data files (may remain as fallback)

```
lib/home-data.ts    WeatherData, ModuleCardData
lib/well-data.ts    WellInfo, WellDailyRecord, SummaryStat, ChartPoint, ...
lib/motor-data.ts   MotorInfo, MotorDailyRecord, MotorStatus, MotorSummaryStat, ...
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
