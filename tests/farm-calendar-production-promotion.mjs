import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const sha256 = (path) => createHash("sha256")
  .update(read(path).replace(/\r\n/g, "\n"))
  .digest("hex")

const manifest = JSON.parse(read("deploy/production-release-manifest.json"))

assert.equal(manifest.base_commit, "e3edbfcd845f5e267e60ea2f028772473f30510a")
assert.deepEqual(manifest.preview_approved, {
  revision: "ec763d202f215097d7ef354a09e02b1c1178e311",
  image_id: "sha256:0c1af4b373021dfe8593e2b522bb60d3ee39f69f820c2758a63bcdee75f3331d",
  feature_revision: "780772d19e47ecb2ecb51530764ec697b466d6e8",
  verified_files: [
    "app/page.tsx",
    "components/home/farm-calendar-card.tsx",
    "lib/farm-calendar.ts",
    "tests/farm-calendar-homepage.mjs",
  ],
})

const previewApprovedDigests = {
  "app/page.tsx": "6cd92f7d2928dfc4504a30e2efcfc32756456e06232cc031b10b26009d23d926",
  "components/home/farm-calendar-card.tsx": "8cecebdf873f0c000fd6d8fd6f9ea02ccb51e13e2972225c5e15c1708529be7f",
  "lib/farm-calendar.ts": "29079701af297a91cefd6a8a595be845c11c58dd7849aa394d53e03332b021c7",
  "tests/farm-calendar-homepage.mjs": "760442b66e845a3ca85b1e818aa16326436e9c9c9ce74e8462b4a80757c0b125",
}

for (const [path, expectedDigest] of Object.entries(previewApprovedDigests)) {
  assert.equal(sha256(path), expectedDigest, `${path} differs from the Preview-approved file`)
}

assert.ok(
  manifest.allowed_paths.includes("tests/farm-calendar-production-promotion.mjs"),
  "The Production promotion parity test must be inside the guarded manifest scope",
)

console.log("Farm Calendar Preview-to-Production source parity checks: PASS")
