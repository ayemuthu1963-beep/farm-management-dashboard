import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [hub, page, client, route, legacyRoute] = await Promise.all([
  readFile(new URL("../app/coconut-harvest/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/coconut-harvest/live-counter/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/coconut/live-counter-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/coconut-harvest/live-counter/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/harvest-live-counter/page.tsx", import.meta.url), "utf8"),
])

assert.match(hub, /Live Harvest Monitor/)
assert.match(hub, /\/coconut-harvest\/live-counter/)
assert.match(page, /Harvest Live Counter/)
assert.match(client, /const REFRESH_MS = 5 \* 60_000/)
assert.match(client, /Single Date/)
assert.match(client, /Date Range/)
assert.match(client, /Total Nuts/)
assert.match(client, /Trees Harvested/)
assert.match(client, /Duplicate Submissions/)
assert.match(client, /Sync Now/)
assert.match(client, /manualRefresh \? `\$\{period\}&refresh=1` : period/)
assert.match(client, /View only/)
assert.doesNotMatch(client, /label: "(?:Bunches|Target|Completion|Approximate)/i)
assert.doesNotMatch(page, /Approximate/i)
assert.match(route, /HARVEST_COUNTER_PUBLIC_API_URL/)
assert.match(route, /from <= to/)
assert.match(legacyRoute, /redirect\("\/coconut-harvest\/live-counter"\)/)

console.log("Harvest Live Counter view-only page, range, refresh, and redirect contracts passed.")
