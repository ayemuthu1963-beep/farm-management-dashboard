import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const sha256 = (path) => createHash("sha256")
  .update(read(path).replace(/\r\n/g, "\n"))
  .digest("hex")

const manifest = JSON.parse(read("deploy/production-release-manifest.json"))

assert.equal(manifest.schema_version, 1)
assert.equal(manifest.environment, "Production")
assert.equal(manifest.target_url, "https://muthufarms.com")
assert.equal(manifest.deployment_kind, "frontend-only")
assert.equal(
  manifest.release_note,
  "Farm Irrigation Table scheduled-versus-actual comparison",
)
assert.equal(manifest.base_commit, "a3e63db408ffbd063d2f58724eed617d130eff22")
assert.deepEqual(manifest.preview_approved, {
  revision: "8c1ce1b2b2945e8968104fb5699d6cbfb16b795f",
  image_id: "sha256:131f76a8dd6532e171dbd68c1da678b1313887ec67fe8af1ee3971cf061c009d",
  feature_revision: "0857b91f661e05b8321bc1646347af248bb8f42b",
  verified_files: [
    "app/irrigation-management/page.tsx",
    "components/irrigation/irrigation-map-with-details.tsx",
    "components/irrigation/irrigation-plan-tables.tsx",
    "lib/irrigation-schedule-comparison.ts",
    "tests/irrigation-management-corrections.mjs",
  ],
  production_adaptations: [
    "deploy/production-release-manifest.json",
    "tests/farm-calendar-production-promotion.mjs",
    "tests/irrigation-plan.mjs",
  ],
})
assert.deepEqual(manifest.protected_invariants, {
  preview: "unchanged",
  test: "unchanged",
  backend: "unchanged",
  database: "unchanged",
  odk: "unchanged",
  schedules: "unchanged",
  proxy_configuration: "unchanged",
})

const previewApprovedDigests = {
  "app/irrigation-management/page.tsx": "68842b3d1797923e6c7d0e0cbfe530a63be4d4a84deb9b0fdc1f428e833bc8b5",
  "components/irrigation/irrigation-map-with-details.tsx": "20029ea95772ee82d3dcd0d23d673e20d0a3676163b1da5592756d83e480370f",
  "components/irrigation/irrigation-plan-tables.tsx": "3303a86d059a9acb7e587eac27a6861facfc11381458e5879b71fed30fbe783a",
  "lib/irrigation-schedule-comparison.ts": "4fa217a24e009c6f3f58ae597c53c45b7256d22671b10abf2858dccd8da594e9",
  "tests/irrigation-management-corrections.mjs": "de58b8e7aa95868075cb91743ef9a174626c3c952d42f92ecb0727b9cad24d7d",
}
for (const [file, expectedDigest] of Object.entries(previewApprovedDigests)) {
  assert.equal(sha256(file), expectedDigest, `${file} differs from the Preview-approved blob`)
}

assert.deepEqual(manifest.allowed_paths, [
  "app/irrigation-management/page.tsx",
  "components/irrigation/irrigation-map-with-details.tsx",
  "components/irrigation/irrigation-plan-tables.tsx",
  "deploy/production-release-manifest.json",
  "lib/irrigation-schedule-comparison.ts",
  "tests/farm-calendar-production-promotion.mjs",
  "tests/irrigation-management-corrections.mjs",
  "tests/irrigation-plan.mjs",
])

const page = read("app/irrigation-management/page.tsx")
const table = read("components/irrigation/irrigation-map-with-details.tsx")
const plan = read("components/irrigation/irrigation-plan-tables.tsx")
assert.match(page, /parsePersistedMotorRunScheduleRows/)
assert.match(page, /motor-run-schedule/)
assert.match(table, /Farm Irrigation Table/)
assert.match(table, /data-water-status=/)
assert.match(table, /min-w-\[96rem\]/)
assert.match(plan, /onPersistedScheduleChange/)
assert.match(plan, /parsePersistedMotorRunScheduleRows/)

const productionProxy = read("app/api/operator-settings/[[...path]]/route.ts")
assert.match(productionProxy, /getAuthenticatedUserAssertionHeaders/)
assert.match(productionProxy, /irrigation-plan/)
assert.match(productionProxy, /drip-output\|motor-run-schedule/)
assert.doesNotMatch(productionProxy, /irrigation-pipeline-signing|worker-management-signing/)

console.log("Farm Irrigation Table scheduled-versus-actual Preview-to-Production parity checks: PASS")
