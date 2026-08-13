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
const globals = await readFile("app/globals.css", "utf8")
const orthomosaic = await readFile("components/maps/farm-orthomosaic-map.tsx", "utf8")

assert.match(mapClient, /const selectAndOpenTree = useCallback/)
assert.match(mapClient, /activePopupRef/)
assert.match(mapClient, /\.setContent\(popupHtml\(entry\.feature, record\)\)/)
assert.match(mapClient, /\.openOn\(map\)/)
assert.doesNotMatch(mapClient, /bindPopup\([^\n]+\)\.openPopup\(\)/)
assert.match(mapClient, /interactive: false,[\s\S]*bubblingMouseEvents: false/)
assert.match(mapClient, /radius: hitRadiusRef\.current/)
assert.match(mapClient, /interactive: true,[\s\S]*bubblingMouseEvents: false/)
assert.match(mapClient, /nearestTreeHit\(/)
assert.match(mapClient, /DomEvent\.stopPropagation\(event\.originalEvent\)/)
assert.match(mapClient, /\.on\("click", handleTreeHit\)/)
assert.match(mapClient, /setView\(\[latitude, longitude\], 21\)/)
assert.match(mapClient, /selectAndOpenTree\(entry\)/)
assert.match(mapClient, /farm-map-tree-label/)
assert.match(mapClient, /keyboard: false/)
assert.match(mapClient, /selectAndOpenTreeRef\.current\?\.\(entry\)/)
assert.match(mapClient, /const labelMarker = leaflet\.marker\([\s\S]*interactive: true/)
assert.match(mapClient, /labelMarker\.on\("click"/)
assert.match(mapClient, /const labelWidth = Math\.max\(26, treeNo\.length \* 7 \+ 9\)/)
assert.match(mapClient, /iconSize: \[labelWidth, 17\]/)
assert.match(mapClient, /iconAnchor: \[labelWidth \/ 2, 25\]/)
assert.doesNotMatch(mapClient, /pointer-events:none/)
assert.doesNotMatch(globals, /\.farm-map-tree-label[\s\S]*pointer-events: none/)

assert.match(mapClient, /\["Tree Number", treeNo\]/)
assert.match(mapClient, /\["Plot", plot\]/)
assert.match(mapClient, /\["Tree status", record\?\.status\]/)
assert.match(mapClient, /\["Lifecycle status", record\?\.lifecycleStatus\]/)
assert.match(mapClient, /\["Performance class", record\?\.classification \?\? "Unknown"\]/)
assert.match(mapClient, /\["Classification reason", record\?\.classificationReason\]/)
assert.match(mapClient, /\["Classification period", record\?\.classificationPeriod\]/)
assert.match(mapClient, /\["Latest harvest date", harvest\?\.date\]/)
assert.match(mapClient, /\["Latest bunches", harvest\?\.totalBunches\]/)
assert.match(mapClient, /\["Latest nuts", harvest\?\.totalNuts\]/)
assert.doesNotMatch(mapClient, /\["Data as of"/)
assert.doesNotMatch(mapClient, /\["Coordinate",/)
assert.doesNotMatch(mapClient, /\["Coordinate version",/)
assert.doesNotMatch(mapClient, /\["Operational match",/)
assert.doesNotMatch(mapClient, /Spatial source:/)

assert.match(mapClient, /const MARKER_ZOOM = 18/)
assert.match(mapClient, /const LABEL_ZOOM = 20/)
assert.match(mapClient, /classificationFilterKey/)
assert.match(mapClient, /grey does not mean Sapling/)
assert.match(orthomosaic, /Orthomosaic opacity/)

console.log("Preview Farm Map single-click, hit-target, and nearest-tree contracts: PASS")
