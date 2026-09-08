import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  DESKTOP_TREE_HIT_RADIUS_PX,
  MOBILE_TREE_HIT_BREAKPOINT_PX,
  TOUCH_TREE_HIT_RADIUS_PX,
  nearestTreeHit,
  treeHitRadiusPx,
} from "../lib/farm-map/tree-hit-testing.ts"

assert.equal(DESKTOP_TREE_HIT_RADIUS_PX, 14)
assert.equal(TOUCH_TREE_HIT_RADIUS_PX, 18)
assert.equal(MOBILE_TREE_HIT_BREAKPOINT_PX, 768)
assert.equal(treeHitRadiusPx({ coarsePointer: false, viewportWidth: 1_440 }), 14)
assert.equal(treeHitRadiusPx({ coarsePointer: true, viewportWidth: 1_440 }), 18)
assert.equal(treeHitRadiusPx({ coarsePointer: false, viewportWidth: 390 }), 18)

const candidates = [
  { id: "101", value: "101", x: 100, y: 100 },
  { id: "102", value: "102", x: 118, y: 100 },
]
assert.equal(nearestTreeHit(candidates, { x: 106, y: 100 }, 14)?.value, "101")
assert.equal(nearestTreeHit(candidates, { x: 112, y: 100 }, 14)?.value, "102")
assert.equal(nearestTreeHit(candidates, { x: 140, y: 100 }, 14), null)
assert.equal(
  nearestTreeHit(
    [
      { id: "35.1", value: "35.1", x: 90, y: 100 },
      { id: "35", value: "35", x: 110, y: 100 },
    ],
    { x: 100, y: 100 },
    14,
  )?.value,
  "35",
)

const mapClient = await readFile("components/maps/farm-map-client.tsx", "utf8")
assert.match(mapClient, /selectedKey/)
assert.match(mapClient, /bindPopup\(popupHtml\(tree\)/)
assert.match(mapClient, /tree\.crop !== "Coconut"\) return/)
assert.match(mapClient, /TreeNo:/)
assert.match(mapClient, /escapeHtml\(tree\.treeNo\)/)
assert.match(mapClient, /visibleFarmLabelKeys/)
assert.match(mapClient, /keyboard: false/)
assert.match(mapClient, /"Tree Number", treeNo/)
assert.match(mapClient, /"Crop", crop/)
await import("./farm-map-three-crops.mjs")
console.log("Farm Map crop-safe click/popups and preserved hit-testing utility contracts: PASS")
