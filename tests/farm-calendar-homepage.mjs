import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { extname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  FARM_CALENDAR_AUTHORIZED_ACCOUNT,
  FARM_CALENDAR_ID,
  FARM_CALENDAR_MONTH_URL,
  FARM_CALENDAR_TIME_ZONE,
  FARM_CALENDAR_WEEKLY_EMBED_URL,
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

const weeklyUrl = new URL(FARM_CALENDAR_WEEKLY_EMBED_URL)
const monthlyUrl = new URL(FARM_CALENDAR_MONTH_URL)

assert.equal(FARM_CALENDAR_ID, "admin.muthufarms@gmail.com")
assert.equal(FARM_CALENDAR_TIME_ZONE, "Asia/Kolkata")
assert.equal(FARM_CALENDAR_AUTHORIZED_ACCOUNT, "ayemuthu1963@gmail.com")
assert.equal(weeklyUrl.hostname, "calendar.google.com")
assert.equal(weeklyUrl.pathname, "/calendar/embed")
assert.equal(weeklyUrl.searchParams.get("src"), FARM_CALENDAR_ID)
assert.equal(weeklyUrl.searchParams.get("ctz"), FARM_CALENDAR_TIME_ZONE)
assert.equal(weeklyUrl.searchParams.get("mode"), "WEEK")
assert.equal(monthlyUrl.hostname, "calendar.google.com")
assert.equal(monthlyUrl.pathname, "/calendar/r/month")
assert.equal(monthlyUrl.searchParams.get("cid"), FARM_CALENDAR_ID)
assert.equal(
  monthlyUrl.searchParams.get("authuser"),
  FARM_CALENDAR_AUTHORIZED_ACCOUNT,
)

assert.match(calendarCard, />\s*Open Monthly Calendar\s*/)
assert.match(calendarCard, /target="_blank"/)
assert.match(calendarCard, /rel="noopener noreferrer"/)
assert.match(calendarCard, /CalendarDays/)
assert.match(calendarCard, /Loading private calendar/)
assert.match(calendarCard, /Calendar could not be loaded/)
assert.match(calendarCard, /A blank week means no events are scheduled/)

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

const forbiddenClientSecret =
  /(?:client_secret|refresh_token|access_token|private_key|ya29\.|-----BEGIN PRIVATE KEY-----|secret address|\.ics\?[^\s"']*secret)/i
const clientSource = `${homePage}\n${calendarCard}\n${calendarConfig}`
assert.doesNotMatch(clientSource, forbiddenClientSecret)
assert.doesNotMatch(clientSource, /NEXT_PUBLIC_[A-Z0-9_]*(?:GOOGLE|CALENDAR|TOKEN|SECRET)/)

const staticRoot = new URL("../.next/static", import.meta.url)
const staticRootPath = fileURLToPath(staticRoot)
let scannedCalendarBundles = 0

if (existsSync(staticRootPath)) {
  for (const entry of readdirSync(staticRootPath, { recursive: true })) {
    const relativePath = String(entry)
    if (extname(relativePath) !== ".js") continue

    const bundle = readFileSync(join(staticRootPath, relativePath), "utf8")
    if (!bundle.includes(FARM_CALENDAR_ID)) continue

    scannedCalendarBundles += 1
    assert.doesNotMatch(bundle, forbiddenClientSecret)
  }
}

console.log(
  `Farm Calendar homepage, private weekly embed, Month link, ordering and client-secret checks: PASS (calendar bundles scanned: ${scannedCalendarBundles})`,
)
