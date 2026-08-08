import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

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

assert.match(layout, /icon: '\/muthu-farms-logo\.png'/)
assert.match(layout, /<PageTitleSync \/>/)
assert.match(titleSync, /document\.title = pageTitleForPathname\(pathname\)/)
assert.match(detailedQuery, /DETAILED_QUERY_PAGE_SIZE = 100/)
assert.match(detailedQuery, /sortedRows\.slice\(firstRowIndex, firstRowIndex \+ DETAILED_QUERY_PAGE_SIZE\)/)
assert.match(detailedQuery, /Page \{page\} of \{totalPages\}/)
assert.match(motorManagement, /file\.size === 0/)
assert.match(motorManagement, /is empty \(0 bytes\)/)
assert.doesNotMatch(navigation, /motor-screenshot-analysis/)
assert.equal(existsSync(new URL("../app/motor-runtime/screenshot-analysis/page.tsx", import.meta.url)), false)

console.log("Dynamic MFMS tab titles, favicon, bounded Detailed Query rendering, empty workbook guard and removed page: PASS")
