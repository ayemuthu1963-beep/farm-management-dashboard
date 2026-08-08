import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [coconutHub, liveCounterHub, page, countingPage, client, route, legacyRoute] = await Promise.all([
  readFile(new URL("../app/coconut-harvest/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/live-harvest-counter/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/coconut-harvest/live-counter/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/coconut-counting/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/coconut/live-counter-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/coconut-harvest/live-counter/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/harvest-live-counter/page.tsx", import.meta.url), "utf8"),
])

assert.doesNotMatch(coconutHub, /Live Harvest Monitor/)
assert.doesNotMatch(coconutHub, /\/coconut-harvest\/live-counter/)
assert.match(liveCounterHub, /Live Harvest Counter/)
assert.match(liveCounterHub, /Harvest Live Counter/)
assert.match(liveCounterHub, /\/coconut-harvest\/live-counter/)
assert.match(liveCounterHub, /Coconut Counting/)
assert.match(liveCounterHub, /\/coconut-counting/)
assert.match(page, /Harvest Live Counter/)
assert.match(countingPage, /CoconutCountingPageHeader/)
assert.match(client, /const REFRESH_MS = 5 \* 60_000/)
assert.match(client, /Single Date/)
assert.match(client, /Date Range/)
assert.match(client, /Total Nuts/)
assert.match(client, /Trees Harvested/)
assert.match(client, /Total Bunches/)
assert.match(client, /Duplicate Submission/)
assert.match(client, /Last Synced/)
assert.match(client, /Sync Now/)
assert.match(client, /manualRefresh \? `\$\{period\}&refresh=1` : period/)
assert.match(client, /View only/)
assert.doesNotMatch(client, /label: "(?:Target|Completion|Approximate)/i)
assert.doesNotMatch(page, /Approximate/i)
const metricLabels = [...client.matchAll(/label: "([^"]+)"/g)].map((match) => match[1])
assert.deepEqual(metricLabels, [
  "Trees Harvested",
  "Total Bunches",
  "Total Nuts",
  "Duplicate Submission",
  "Last Synced",
])
assert.match(client, /xl:grid-cols-5/)
assert.match(route, /HARVEST_COUNTER_PUBLIC_API_URL/)
assert.match(route, /from <= to/)
assert.match(legacyRoute, /redirect\("\/coconut-harvest\/live-counter"\)/)

console.log("Harvest Live Counter view-only page, range, refresh, and redirect contracts passed.")
