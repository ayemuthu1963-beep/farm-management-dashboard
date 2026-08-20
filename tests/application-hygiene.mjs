import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import { getApiBaseUrl } from "../lib/api.ts"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

const originalApiBaseUrl = process.env.HARVEST_API_BASE_URL
try {
  delete process.env.HARVEST_API_BASE_URL
  assert.throws(() => getApiBaseUrl(), /HARVEST_API_BASE_URL is required/)

  process.env.HARVEST_API_BASE_URL = "http://harvest-api-pilot:8000/"
  assert.equal(getApiBaseUrl(), "http://harvest-api-pilot:8000")

  process.env.HARVEST_API_BASE_URL = "file:///tmp/not-an-api"
  assert.throws(() => getApiBaseUrl(), /must use HTTP or HTTPS/)
} finally {
  if (originalApiBaseUrl === undefined) delete process.env.HARVEST_API_BASE_URL
  else process.env.HARVEST_API_BASE_URL = originalApiBaseUrl
}

const [
  fertiliserPage,
  fertiliserApi,
  harvestCyclePage,
  harvestCycleClient,
  harvestSyncPage,
  adminNotice,
  beetleAdmin,
  counterRoute,
  layout,
  map,
  farmMapClient,
  odk,
  previewDockerfile,
] = await Promise.all([
  read("app/fertiliser-management/page.tsx"),
  read("lib/fertiliser-api.ts"),
  read("app/admin/harvest-cycle/page.tsx"),
  read("components/admin/harvest-cycle-admin-client.tsx"),
  read("app/admin/harvest-sync/page.tsx"),
  read("components/admin/preview-admin-notice.tsx"),
  read("components/admin/beetle-trap-admin-client.tsx"),
  read("app/api/coconut-harvest/live-counter/route.ts"),
  read("app/layout.tsx"),
  read("components/maps/farm-orthomosaic-map.tsx"),
  read("components/maps/farm-map-client.tsx"),
  read("lib/odk-preview.ts"),
  read("Dockerfile.preview"),
])

assert.doesNotMatch(fertiliserPage, /MFMS Preview stock corrections|Create Preview planned requirements/)
assert.doesNotMatch(fertiliserPage, /guarded Preview\/UAT database|source: "mfms_server_uat"/)
assert.match(fertiliserPage, /source: fertiliserDatabase/)
assert.doesNotMatch(fertiliserApi, /Preview server rejected/)

assert.doesNotMatch(harvestCyclePage, />Preview Admin</)
assert.doesNotMatch(harvestCycleClient, /opened in Preview|Preview database was updated/)
assert.doesNotMatch(harvestCycleClient, /MFMS Preview database|Production is not targeted/)
assert.match(harvestCycleClient, /publicEnvironmentIdentity/)
assert.match(adminNotice, /LIVE OPERATIONAL DATA/)
assert.match(adminNotice, /TEST DATA \/ TEST ACTIONS ONLY/)
assert.match(adminNotice, /NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL/)
assert.doesNotMatch(harvestSyncPage, /Preview Harvest Admin|Environment:<\/span> Preview \/ UAT|Database:<\/span> mfms_server_uat/)
assert.doesNotMatch(beetleAdmin, /active trap locations from Preview/)

assert.doesNotMatch(counterRoute, /mfms-harvest-counter-api-preview/)
assert.match(counterRoute, /Harvest counter upstream is not configured/)
assert.match(counterRoute, /HARVEST_COUNTER_PUBLIC_API_URL/)

assert.match(layout, /process\.env\.VERCEL === '1'/)
assert.doesNotMatch(layout, /process\.env\.NODE_ENV === ['"]production['"]/)

assert.match(map, /new PMTiles\(farmCombinedLayer\.pmtilesUrl\)/)
assert.match(map, /leafletRasterLayer/)
assert.doesNotMatch(map, /leaflet\.tileLayer\(farmCombinedLayer\.tileUrl/)
assert.doesNotMatch(farmMapClient, /MFMS Farm Map — Preview\/UAT/)

assert.match(odk, /"22": \{ wellWater: "20260808\.1", beetleTrap: "20260808\.1", harvest: "20260808\.1" \}/)
assert.match(odk, /"23": \{ wellWater: "20260723\.2", beetleTrap: "20260723\.1", harvest: "20260827\.2" \}/)
assert.match(odk, /"24": \{ wellWater: "20260808\.1", beetleTrap: "20260808\.1", harvest: "20260808\.1" \}/)
assert.doesNotMatch(odk, /NEXT_PUBLIC_MFMS_ENV \?\? "preview"/)
assert.match(odk, /"unconfigured"/)

assert.equal((previewDockerfile.match(/HARVEST_COUNTER_PUBLIC_API_URL/g) ?? []).length, 2)
assert.match(previewDockerfile, /mfms-harvest-counter-api-preview:8787\/api\/harvest-counter\/public/)

console.log("MFMS Preview application hygiene source contracts: PASS")
