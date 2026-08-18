import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const sha256 = (path) => createHash("sha256")
  .update(read(path).replace(/\r\n/g, "\n"))
  .digest("hex")

const manifest = JSON.parse(read("deploy/production-release-manifest.json"))

assert.equal(manifest.deployment_kind, "frontend-only")
assert.equal(manifest.base_commit, "9a577add2308b85637fcf05ee49b6274e19cc2dc")
assert.deepEqual(manifest.preview_approved, {
  revision: "f5c4c465fed1ccd68cab1286e705ed8215b53f17",
  image_id: "sha256:e69ee588ebbee6b87264342c5c11ec72ca7f52e8530ffc5c3eadff9678236053",
  feature_revision: "6f1773b25195c6daf4c3b58f6989ba9a330a3ea9",
  verified_files: [
    "app/irrigation-management/page.tsx",
    "components/irrigation/irrigation-map-with-details.tsx",
    "components/irrigation/irrigation-plan-tables.tsx",
    "lib/public-environment.ts",
    "tests/irrigation-environment-copy.mjs",
  ],
  production_adaptations: [
    "package.json",
    "tests/irrigation-plan.mjs",
  ],
})

const previewApprovedDigests = {
  "app/irrigation-management/page.tsx": "724ce549afa9fcb4a219a24e5c905635acd19dd7eced6b8f082f5f32c57191c8",
  "components/irrigation/irrigation-map-with-details.tsx": "7f4ec6f3944c4d74310e64f28af1a680230d67436fc64ea0f863e675d7b90997",
  "components/irrigation/irrigation-plan-tables.tsx": "0852afe6e4773e509fe45d699fbd5f943f0c18414e671752a9f6255fb9d78b85",
  "lib/public-environment.ts": "c5a0671fdc9060e1a5916196299548ea2ab4c8bded835e87299665ee2e50f7e1",
  "tests/irrigation-environment-copy.mjs": "a617783bb8e57c46d441ea1ff09dfb22afbeb79cb74a63b081a7f2a2df3d54f6",
}

const productionProxy = read("app/api/operator-settings/[[...path]]/route.ts")
assert.match(productionProxy, /getAuthenticatedUserAssertionHeaders/)
assert.match(productionProxy, /irrigation-plan/)
assert.match(productionProxy, /drip-output\|motor-run-schedule/)
assert.doesNotMatch(productionProxy, /irrigation-pipeline-signing|worker-management-signing/)

for (const [path, expectedDigest] of Object.entries(previewApprovedDigests)) {
  assert.equal(sha256(path), expectedDigest, `${path} differs from the Preview-approved file`)
}

assert.deepEqual(manifest.allowed_paths, [
  "app/irrigation-management/page.tsx",
  "components/irrigation/irrigation-map-with-details.tsx",
  "components/irrigation/irrigation-plan-tables.tsx",
  "deploy/production-release-manifest.json",
  "lib/public-environment.ts",
  "package.json",
  "tests/farm-calendar-production-promotion.mjs",
  "tests/irrigation-environment-copy.mjs",
  "tests/irrigation-plan.mjs",
])

assert.notEqual(manifest.preview_approved.revision, "26cb0e1ec52bec3dcdd2533c7f01fcfdff34737c")
assert.notEqual(manifest.preview_approved.image_id, "sha256:ee78c4b6c9601b209f0cf225a735b3699955f71463caf8c4ae0a0938a3ae8888")

console.log("Irrigation Management text correction Preview-to-Production parity checks: PASS")
