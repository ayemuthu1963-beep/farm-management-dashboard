import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const sha256 = (path) => createHash("sha256")
  .update(read(path).replace(/\r\n/g, "\n"))
  .digest("hex")

const manifest = JSON.parse(read("deploy/production-release-manifest.json"))

assert.equal(manifest.base_commit, "e9833917c0a7fd190d933acb8cb234f60f5c8c65")
assert.deepEqual(manifest.preview_approved, {
  revision: "108314fee0f3ae0d7962e1a7f0d7b98866a75a5c",
  image_id: "sha256:d8cee1e9e591db1b1d35930ac0d89d1bf8b9e2ae2723722c5fe6e418832ec186",
  feature_revision: "04fd5664137809605721665cafd6ffaad4264ec9",
  verified_files: [
    "app/irrigation-management/page.tsx",
    "components/irrigation/irrigation-charts-hybrid.tsx",
    "components/irrigation/irrigation-map-with-details.tsx",
    "components/irrigation/irrigation-plan-tables.tsx",
    "lib/irrigation-plan.ts",
    "tests/irrigation-management-corrections.mjs",
    "tests/operator-settings-persistence.mjs",
  ],
  production_adaptations: [
    "app/api/operator-settings/[[...path]]/route.ts",
    "tests/irrigation-plan.mjs",
  ],
})

const previewApprovedDigests = {
  "app/irrigation-management/page.tsx": "989d946de2bebd41318a5471f88a781c397750409928366c415b5fd75d690d22",
  "components/irrigation/irrigation-charts-hybrid.tsx": "392d90595ee35870670ffa4a2cc0ca2efafea2b6e0f6efd95d8025039a5fa8ff",
  "components/irrigation/irrigation-map-with-details.tsx": "b60ff79e5577187a0d4398537e857ea5eb610beb32a74a6a391b2c1b907eb19e",
  "components/irrigation/irrigation-plan-tables.tsx": "4bb25e9c7d5c8a07c3200fc48ad8c263c92113b655207d1d525de4e14da5f390",
  "lib/irrigation-plan.ts": "c0bace98f52146e6b69a39d000ffed07bb7eb3d99c85c7da7407867a35d37e67",
  "tests/irrigation-management-corrections.mjs": "a1f8f9e26a9a09ac1916ffb74ab74f36e3c89d38dc829035e4ee72765e32e778",
  "tests/operator-settings-persistence.mjs": "aeff3f0e066a7203da11310cd9510b185976c5973336154af93441f57e535e50",
}

const productionProxy = read("app/api/operator-settings/[[...path]]/route.ts")
assert.match(productionProxy, /getAuthenticatedUserAssertionHeaders/)
assert.match(productionProxy, /irrigation-plan/)
assert.match(productionProxy, /drip-output\|motor-run-schedule/)
assert.doesNotMatch(productionProxy, /irrigation-pipeline-signing|worker-management-signing/)

for (const [path, expectedDigest] of Object.entries(previewApprovedDigests)) {
  assert.equal(sha256(path), expectedDigest, `${path} differs from the Preview-approved file`)
}

assert.ok(
  manifest.allowed_paths.includes("tests/farm-calendar-production-promotion.mjs"),
  "The Production promotion parity test must be inside the guarded manifest scope",
)

assert.notEqual(manifest.preview_approved.revision, "26cb0e1ec52bec3dcdd2533c7f01fcfdff34737c")
assert.notEqual(manifest.preview_approved.image_id, "sha256:ee78c4b6c9601b209f0cf225a735b3699955f71463caf8c4ae0a0938a3ae8888")

console.log("Irrigation Management Preview-to-Production source parity checks: PASS")
