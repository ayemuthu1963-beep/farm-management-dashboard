import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [admin, proxy, api, treeView, performance, detailed, treeWise, workbook] = await Promise.all([
  read("components/admin/coconut-bunch-tying-admin-client.tsx"),
  read("app/api/admin/coconut-bunch-tying/[[...path]]/route.ts"),
  read("lib/coconut-harvest-api.ts"),
  read("components/coconut/tree-view-client.tsx"),
  read("app/coconut-harvest/tree-performance/page.tsx"),
  read("app/coconut-harvest/detailed-query/page.tsx"),
  read("app/coconut-harvest/tree-wise-query/page.tsx"),
  read("lib/tree-wise-query-excel.ts"),
])

assert.match(admin, /TreeNo/)
assert.match(admin, /BunchesTied/)
assert.match(admin, /partial import is not allowed/i)
assert.match(admin, /unreported/i)
assert.match(admin, /preview\.errors\.length > 0/)
assert.match(admin, /Excel Import/)
assert.match(admin, /Tying History/)
assert.match(admin, /Round Coverage & Follow-up/)
assert.match(admin, /plot_breakdown/)
assert.match(admin, /follow_up/)
assert.match(admin, /\/coverage/)
assert.match(admin, /Export CSV/)
assert.match(admin, /Search Tree No/)
assert.match(admin, /setFollowUpSearch\(""\)/)
assert.match(proxy, /getPreviewAdminWriteSafetyErrors/)
assert.match(proxy, /getAuthenticatedUserAssertionHeaders/)
assert.match(proxy, /import\\\/\(validate\|apply\)/)
assert.match(proxy, /source\|coverage/)

assert.match(api, /BunchTyingHistoryRow/)
assert.match(api, /latestTiedBunches: number \| null/)
assert.match(api, /toNullableNumber/)
assert.match(api, /tiedFrom: "tied_from"/)
assert.match(api, /tyingRound: "tying_round"/)

assert.match(treeView, /Bunch Tying History/)
assert.match(treeView, /row\.bunchesTied/)
assert.match(treeView, /not reported/)
assert.match(performance, /Latest Tied Bunches/)
assert.match(performance, /Tied Trees/)
assert.match(detailed, /Latest Bunches Tied/)
assert.match(detailed, /Tying Round/)
assert.match(treeWise, /latestTiedBunches: "Latest Tied Bunches"/)
assert.match(treeWise, /row\[field\] \?\? "—"/, "zero must not render as a blank")
assert.match(workbook, /value: \(row\) => row\[field\] \?\? ""/, "unreported values must export blank")

console.log("Coconut bunch-tying Admin and four-view contracts passed.")
