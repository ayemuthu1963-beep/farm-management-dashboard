import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { pageTitleForPathname } from "../lib/page-titles.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

assert.equal(pageTitleForPathname("/"), "MFMS-Dashboard")
assert.equal(pageTitleForPathname("/coconut-harvest"), "MFMS-Coconut Harvest")
assert.equal(pageTitleForPathname("/well-water"), "MFMS-Well Water Data")
assert.equal(pageTitleForPathname("/admin/motor-runtime"), "MFMS-Motor Runtime Management")
assert.equal(pageTitleForPathname("/coconut-harvest/detailed-query"), "MFMS-Coconut Detailed Query")
assert.equal(pageTitleForPathname("/unknown-new-page"), "MFMS-Unknown New Page")

const layout = read("app/layout.tsx")
const titleSync = read("components/farm/page-title-sync.tsx")
const detailedQuery = read("app/coconut-harvest/detailed-query/page.tsx")
const motorManagement = read("components/admin/motor-runtime-management-client.tsx")
const navigation = read("lib/mfms-navigation.ts")
const weatherPage = read("app/weather/page.tsx")

assert.match(layout, /icon: '\/muthu-farms-logo\.png'/)
assert.match(layout, /<PageTitleSync \/>/)
assert.match(titleSync, /document\.title = pageTitleForPathname\(pathname\)/)
assert.match(weatherPage, /title: "MFMS-Weather"/)
assert.doesNotMatch(weatherPage, /Live Weather \| Muthu Farms/)

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url))
const appRoot = path.join(repositoryRoot, "app")
const pageFiles = readdirSync(appRoot, { recursive: true })
  .map((entry) => String(entry).replaceAll("\\", "/"))
  .filter((entry) => entry.endsWith("/page.tsx"))
for (const pageFile of pageFiles) {
  const route = `/${pageFile.slice(0, -"/page.tsx".length)}`
  const layoutPath = path.join(appRoot, path.dirname(pageFile), "layout.tsx")
  assert.equal(existsSync(layoutPath), true, `${route} must have server-rendered route metadata`)
  assert.match(
    readFileSync(layoutPath, "utf8"),
    new RegExp(`title: ${JSON.stringify(pageTitleForPathname(route))}`),
    `${route} metadata title must match the client-side title`,
  )
}
assert.match(detailedQuery, /DETAILED_QUERY_PAGE_SIZE = 100/)
assert.match(detailedQuery, /sortedRows\.slice\(firstRowIndex, firstRowIndex \+ DETAILED_QUERY_PAGE_SIZE\)/)
assert.match(detailedQuery, /Page \{page\} of \{totalPages\}/)
assert.match(motorManagement, /file\.size === 0/)
assert.match(motorManagement, /is empty \(0 bytes\)/)
assert.doesNotMatch(navigation, /motor-screenshot-analysis/)
assert.equal(existsSync(new URL("../app/motor-runtime/screenshot-analysis/page.tsx", import.meta.url)), false)

console.log("Dynamic MFMS tab titles, favicon, bounded Detailed Query rendering, empty workbook guard and removed page: PASS")
