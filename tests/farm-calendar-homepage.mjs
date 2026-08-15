import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  FARM_CALENDAR_ACCOUNT,
  FARM_CALENDAR_URL,
} from "../lib/farm-calendar.ts"
import { homepageNavigationItems } from "../lib/mfms-navigation.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const homePage = read("app/page.tsx")
const calendarCard = read("components/home/farm-calendar-card.tsx")
const calendarConfig = read("lib/farm-calendar.ts")

const weatherIndex = homePage.indexOf("<WeatherCard")
const calendarIndex = homePage.indexOf("<FarmCalendarCard")
const existingModulesIndex = homePage.indexOf("moduleCards.map")

assert.ok(weatherIndex >= 0, "Weather tile must remain on the homepage")
assert.ok(calendarIndex > weatherIndex, "Farm Calendar must follow Weather")
assert.ok(
  existingModulesIndex > calendarIndex,
  "Existing homepage modules must follow Farm Calendar",
)

assert.equal(
  FARM_CALENDAR_URL,
  "https://calendar.google.com/calendar/u/8/r?tab=wc",
)
assert.equal(FARM_CALENDAR_ACCOUNT, "admin.muthufarms@gmail.com")
assert.match(calendarCard, /<a[\s\S]*href=\{FARM_CALENDAR_URL\}/)
assert.match(calendarCard, /target="_blank"/)
assert.match(calendarCard, /rel="noopener noreferrer"/)
assert.match(calendarCard, /aria-label="Open Farm Calendar in a new tab"/)
assert.match(calendarCard, />\s*Farm Calendar\s*</)
assert.match(calendarCard, />\s*Open Farm Calendar\s*/)
assert.match(calendarCard, /CalendarDays/)

assert.deepEqual(
  homepageNavigationItems
    .filter((item) => item.id !== "todays-weather")
    .map((item) => item.id),
  [
    "coconut-harvest",
    "jackfruit-monitoring",
    "well-water-level",
    "motor-runtime",
    "irrigation-management",
    "beetle-trap-monitoring",
    "pipeline-layout-inspection",
    "farm-map",
    "fertiliser-management",
    "weather-history",
    "farm-reports",
    "worker-management",
    "inventory-management",
    "admin-console",
  ],
  "Existing module ordering must not change",
)

const calendarSource = `${homePage}\n${calendarCard}\n${calendarConfig}`
for (const forbidden of [
  /<iframe/i,
  /calendar\/embed/i,
  /googleapis\.com/i,
  /oauth/i,
  /service[_ -]?account/i,
  /refresh[_ -]?token/i,
  /client[_ -]?secret/i,
  /access[_ -]?token/i,
  /NEXT_PUBLIC_[A-Z0-9_]*(?:GOOGLE|CALENDAR|TOKEN|SECRET)/,
]) {
  assert.doesNotMatch(calendarSource, forbidden)
}

console.log(
  "Farm Calendar external-link tile, ordering, new-tab and no-embed/API/OAuth checks: PASS",
)
