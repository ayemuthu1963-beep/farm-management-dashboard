import assert from "node:assert/strict"
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

assert.equal(homepageNavigationItems.length, 15, "Homepage must contain exactly 15 tiles")
assert.equal(
  new Set(homepageNavigationItems.map((item) => item.id)).size,
  15,
  "Homepage tile IDs must be unique",
)

const dashboard = mfmsNavigationItems.find((item) => item.id === "dashboard")
assert.ok(dashboard)
assert.equal(dashboard.href, "/")
assert.equal(dashboard.showOnDashboard, false)
assert.equal(dashboard.showInSidebar, true)

const sidebarById = new Map(sidebarNavigationItems.map((item) => [item.id, item]))
for (const tile of homepageNavigationItems.filter((item) => !item.external)) {
  const sidebarItem = sidebarById.get(tile.id)
  assert.ok(sidebarItem, `${tile.label} must appear in the sidebar`)
  assert.equal(sidebarItem.label, tile.label)
  assert.equal(sidebarItem.href, tile.href)
  assert.equal(sidebarItem.icon, tile.icon)
}

const motorRuntime = sidebarById.get("motor-runtime")
const motorScreenshotAnalysis = sidebarById.get("motor-screenshot-analysis")
assert.ok(motorRuntime)
assert.ok(motorScreenshotAnalysis)
assert.equal(motorScreenshotAnalysis.href, "/motor-runtime/screenshot-analysis")
assert.equal(motorScreenshotAnalysis.showOnDashboard, false)
assert.equal(motorScreenshotAnalysis.showInSidebar, true)
assert.equal(
  homepageNavigationItems.some((item) => item.id === "motor-screenshot-analysis"),
  false,
  "Screenshot analysis must not alter the approved homepage card grid",
)

const reports = mfmsNavigationItems.find((item) => item.id === "farm-reports")
assert.ok(reports)
assert.equal(reports.label, "Farm Reports")
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
assert.equal(
  isNavigationItemActive("/motor-runtime/screenshot-analysis", motorRuntime),
  false,
)
assert.equal(
  isNavigationItemActive("/motor-runtime/screenshot-analysis", motorScreenshotAnalysis),
  true,
)
assert.equal(isNavigationItemActive("/well-water", sidebarById.get("well-water-level")), true)
assert.equal(
  isNavigationItemActive(
    "/coconut-harvest/tree-view",
    sidebarById.get("coconut-harvest"),
  ),
  true,
)
assert.equal(isNavigationItemActive("/well-water", sidebarById.get("coconut-harvest")), false)
assert.equal(isNavigationItemActive("/under-construction", reports), false)

const sidebarSource = readFileSync(join(repoRoot, "components/farm/sidebar.tsx"), "utf8")
const shellSource = readFileSync(join(repoRoot, "components/farm/dashboard-shell.tsx"), "utf8")
assert.match(sidebarSource, /sidebarNavigationItems/)
assert.doesNotMatch(sidebarSource, /href:\s*["']#["']/)
assert.match(shellSource, /<Sidebar onNavigate=\{\(\) => setOpen\(false\)\} \/>/)

console.log("MFMS shared navigation, route, active-state, desktop and mobile invariants: PASS")
