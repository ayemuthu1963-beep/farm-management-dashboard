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
  revision: "fc791dfb090874e8ba16408ee38f910f161c9a52",
  image_id: "sha256:4159d9e484855be68eacf32a41b895e311ff2957b56f3be05f39dfae133cf266",
  feature_revision: "6ab5216a7dba47204321a66b145de6bc6ff56086",
  verified_files: [
    "app/api/operator-settings/[[...path]]/route.ts",
    "app/irrigation-management/page.tsx",
    "components/irrigation/irrigation-charts-hybrid.tsx",
    "components/irrigation/irrigation-map-with-details.tsx",
    "components/irrigation/irrigation-plan-tables.tsx",
    "lib/irrigation-plan.ts",
    "tests/irrigation-management-corrections.mjs",
    "tests/irrigation-plan.mjs",
    "tests/operator-settings-persistence.mjs",
  ],
})

const previewApprovedDigests = {
  "app/api/operator-settings/[[...path]]/route.ts": "19f9bd02a39e3548b1ff19499571e1b1a7f786462c4c8228b29a93b556fc2727",
  "app/irrigation-management/page.tsx": "989d946de2bebd41318a5471f88a781c397750409928366c415b5fd75d690d22",
  "components/irrigation/irrigation-charts-hybrid.tsx": "392d90595ee35870670ffa4a2cc0ca2efafea2b6e0f6efd95d8025039a5fa8ff",
  "components/irrigation/irrigation-map-with-details.tsx": "b60ff79e5577187a0d4398537e857ea5eb610beb32a74a6a391b2c1b907eb19e",
  "components/irrigation/irrigation-plan-tables.tsx": "9c39d156279a201d6fa7633ac67f9bc44ae134f9411400c4abbb22337a9f412d",
  "lib/irrigation-plan.ts": "397c632cf9a9ab7e1802ccba449870c1c53b64f3d61158daaa8fed66629f2146",
  "tests/irrigation-management-corrections.mjs": "a1f8f9e26a9a09ac1916ffb74ab74f36e3c89d38dc829035e4ee72765e32e778",
  "tests/irrigation-plan.mjs": "f9a41dd35b45249aea4a876d4a2d65ce9d0eac0ee221160eb50b24731e632e30",
  "tests/operator-settings-persistence.mjs": "b75e10872e5d3052390556e81ed4a4e2ca736f32305eb31d5a441eb229dce819",
}

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
