import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [dashboard, chart, adminClient, waterRoute, adminRoute, adminPage] = await Promise.all([
  readFile(new URL("../app/beetle-trap/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/beetle/beetle-daily-chart.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/admin/beetle-trap-admin-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/admin/beetle-trap/water-changes/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/admin/beetle-trap/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/admin/beetle-trap/page.tsx", import.meta.url), "utf8"),
])

assert.match(dashboard, /water_changes: Array<\{ water_changed_on: string \}>/)
assert.match(dashboard, /Water changed — all active traps/)
assert.match(dashboard, /bg-chart-2\/15/)
assert.match(dashboard, /colSpan=\{4\}/)
assert.match(dashboard, /dailyTableRows\(data, rows\)/)
assert.match(chart, /dataKey="plot1RedPalmWeevil" name="Plot 1 — Red Palm Weevil"/)
assert.match(chart, /dataKey="plot1Rhinoceros" name="Plot 1 — Rhinoceros Beetle"/)
assert.match(chart, /dataKey="plot2RedPalmWeevil" name="Plot 2 — Red Palm Weevil"/)
assert.match(chart, /dataKey="plot2Rhinoceros" name="Plot 2 — Rhinoceros Beetle"/)
assert.doesNotMatch(chart, /dataKey="rhinoceros" name="Rhinoceros"/)
assert.doesNotMatch(chart, /dataKey="redPalmWeevil" name="Red Palm Weevil"/)
assert.match(chart, /ReferenceLine/)
assert.match(chart, /x=\{date\} stroke="var\(--chart-2\)"/)
assert.match(chart, /plot2RedPalmWeevil[\s\S]*stroke="var\(--destructive\)"[\s\S]*strokeDasharray="5 3"/)
assert.match(chart, /plot2Rhinoceros[\s\S]*stroke="var\(--foreground\)"[\s\S]*strokeDasharray="5 3"/)
assert.match(dashboard, /waterChangeDates=\{waterChangeDates\}/)
assert.match(adminClient, /Water Changed/)
assert.match(adminClient, /Save Water Change/)
assert.match(adminClient, /\/api\/admin\/beetle-trap\/water-changes/)
assert.match(waterRoute, /\/api\/beetle-trap\/water-changes/)
assert.match(waterRoute, /Water Changed is required/)
assert.match(waterRoute, /getPreviewAdminWriteSafetyErrors/)
assert.match(adminRoute, /latest_water_change/)
assert.match(adminPage, /latest_water_change/)

console.log("Beetle Trap water-change and four-line trend contracts passed.")
