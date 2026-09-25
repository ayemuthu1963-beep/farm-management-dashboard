import assert from "node:assert/strict"
import { BarChart3, Brain, CalendarDays, CloudSun, ShieldCog } from "lucide-react"
import { FARM_CALENDAR_URL } from "../lib/farm-calendar.ts"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  homepageNavigationItems,
  isNavigationItemActive,
  mfmsNavigationItems,
  sidebarNavigationItems,
} from "../lib/mfms-navigation.ts"

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))

assert.equal(homepageNavigationItems.length, 17, "Homepage must contain exactly 17 tiles")
assert.equal(
  new Set(homepageNavigationItems.map((item) => item.id)).size,
  17,
  "Homepage tile IDs must be unique",
)

const dashboard = mfmsNavigationItems.find((item) => item.id === "dashboard")
assert.ok(dashboard)
assert.equal(dashboard.href, "/")
assert.equal(dashboard.showOnDashboard, false)
assert.equal(dashboard.showInSidebar, true)

const intelligence = mfmsNavigationItems.find((item) => item.id === "mfms-intelligence")
assert.ok(intelligence)
assert.equal(intelligence.href, "/intelligence")
assert.equal(intelligence.showOnDashboard, true)
assert.equal(intelligence.showInSidebar, true)

const sidebarById = new Map(sidebarNavigationItems.map((item) => [item.id, item]))
for (const tile of homepageNavigationItems) {
  const sidebarItem = sidebarById.get(tile.id)
  assert.ok(sidebarItem, `${tile.label} must appear in the sidebar`)
  assert.equal(sidebarItem.label, tile.label)
  assert.equal(sidebarItem.href, tile.href)
  assert.equal(sidebarItem.icon, tile.icon)
}

assert.equal(homepageNavigationItems.some((item) => item.id === "weather-history"), false)
const weather = sidebarById.get("todays-weather")
assert.ok(weather)
assert.equal(weather.label, "Live Weather – Muthu Farms")
assert.equal(weather.href, "/weather")
assert.equal(weather.icon, CloudSun)
const calendar = sidebarById.get("farm-calendar")
assert.ok(calendar)
assert.equal(calendar.label, "Farm Calendar")
assert.equal(calendar.href, FARM_CALENDAR_URL)
assert.equal(calendar.icon, CalendarDays)
assert.equal(calendar.external, true)
assert.equal(calendar.showOnDashboard, true)
assert.equal(intelligence.icon, Brain)
const admin = sidebarById.get("admin-console")
assert.ok(admin)
assert.equal(admin.label, "Admin Console")
assert.equal(admin.href, "/admin")
assert.equal(admin.icon, ShieldCog)
assert.equal(
  new Set(homepageNavigationItems.map((item) => item.icon)).size,
  homepageNavigationItems.length,
  "Homepage modules must use distinct relevant icons",
)

const motorRuntime = sidebarById.get("motor-runtime")
const liveHarvestCounter = sidebarById.get("live-harvest-counter")
assert.ok(motorRuntime)
assert.ok(liveHarvestCounter)
assert.equal(liveHarvestCounter.label, "Live Harvest Counter")
assert.equal(liveHarvestCounter.href, "/live-harvest-counter")
assert.equal(liveHarvestCounter.showOnDashboard, true)
assert.equal(liveHarvestCounter.dashboardIcon, "/mfms/icons/coconut-harvest.png")
assert.equal(liveHarvestCounter.ctaLabel, "Open Counter")
assert.deepEqual(liveHarvestCounter.activeHrefs, [
  "/coconut-harvest/live-counter",
  "/coconut-counting",
])
assert.equal(sidebarById.has("coconut-counting"), false)
assert.equal(
  homepageNavigationItems.some((item) => item.id === "motor-screenshot-analysis"),
  false,
  "Screenshot analysis must not alter the approved homepage card grid",
)
assert.equal(sidebarById.has("motor-screenshot-analysis"), false)
assert.equal(existsSync(join(repoRoot, "app", "motor-runtime", "screenshot-analysis", "page.tsx")), false)

const reports = mfmsNavigationItems.find((item) => item.id === "farm-reports")
assert.ok(reports)
assert.equal(reports.label, "Farm Reports")
assert.equal(reports.icon, BarChart3)
assert.equal(reports.status, "coming-soon")
assert.equal(reports.href, "/under-construction")
assert.notEqual(reports.href, "/coconut-harvest")

assert.equal(
  mfmsNavigationItems.some((item) => item.id === "settings" || item.label === "Settings"),
  false,
  "Settings must not appear because no homepage tile or route exists",
)

for (const item of mfmsNavigationItems) {
  if (item.id !== "coconut-harvest") {
    assert.notEqual(item.href, "/coconut-harvest", `${item.label} must not route to Coconut Harvest`)
  }
  if (!item.external) {
    const route = item.href === "/" ? "" : item.href
    assert.ok(
      existsSync(join(repoRoot, "app", route, "page.tsx")),
      `Route file must exist for ${item.label}: ${item.href}`,
    )
  }
  if (item.status === "coming-soon") {
    assert.equal(item.href, "/under-construction")
  }
}

assert.equal(isNavigationItemActive("/", dashboard), true)
assert.equal(isNavigationItemActive("/motor-runtime", motorRuntime), true)
assert.equal(isNavigationItemActive("/well-water", sidebarById.get("well-water-level")), true)
assert.equal(
  isNavigationItemActive(
    "/coconut-harvest/tree-view",
    sidebarById.get("coconut-harvest"),
  ),
  true,
)
assert.equal(isNavigationItemActive("/live-harvest-counter", liveHarvestCounter), true)
assert.equal(isNavigationItemActive("/coconut-counting", liveHarvestCounter), true)
assert.equal(isNavigationItemActive("/coconut-harvest/live-counter", liveHarvestCounter), true)
assert.equal(
  isNavigationItemActive("/coconut-harvest/live-counter", sidebarById.get("coconut-harvest")),
  false,
)
assert.equal(isNavigationItemActive("/well-water", sidebarById.get("coconut-harvest")), false)
assert.equal(isNavigationItemActive("/under-construction", reports), false)

const sidebarSource = readFileSync(join(repoRoot, "components/farm/sidebar.tsx"), "utf8")
const shellSource = readFileSync(join(repoRoot, "components/farm/dashboard-shell.tsx"), "utf8")
assert.match(sidebarSource, /sidebarNavigationItems/)
assert.doesNotMatch(sidebarSource, /href:\s*["']#["']/)
assert.match(shellSource, /<Sidebar onNavigate=\{\(\) => setOpen\(false\)\} \/>/)

const moduleSource = readFileSync(join(repoRoot, "components/home/module-card.tsx"), "utf8")
const homeDataSource = readFileSync(join(repoRoot, "lib/home-data.ts"), "utf8")
const weatherSource = readFileSync(join(repoRoot, "components/home/weather-card.tsx"), "utf8")
assert.match(homeDataSource, /icon: item.icon/)
assert.match(moduleSource, /const Icon = data.icon/)
assert.match(moduleSource, /<Icon /)
assert.match(weatherSource, /weatherNavigation.label/)
assert.match(weatherSource, /href=\{weatherNavigation.href\}/)
assert.match(weatherSource, /const WeatherIcon = weatherNavigation.icon/)
assert.match(sidebarSource, /target=\{item.external \? "_blank" : undefined\}/)
assert.doesNotMatch(sidebarSource, /className="truncate"/)

console.log("MFMS shared navigation, route, icon and responsive-source invariants: PASS")
