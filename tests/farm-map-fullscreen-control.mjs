import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const mapShell = readFileSync(resolve(root, "components/maps/farm-map-orthomosaic.tsx"), "utf8")
const farmMap = readFileSync(resolve(root, "components/maps/farm-map-client.tsx"), "utf8")

assert.match(farmMap, /enableFullscreen/)
assert.match(mapShell, /aria-label=\{isMapExpanded \? "Exit full screen" : "Open map full screen"\}/)
assert.match(mapShell, /aria-expanded=\{isMapExpanded\}/)
assert.match(mapShell, /aria-keyshortcuts="Escape"/)
assert.match(mapShell, /container\.requestFullscreen\(\)/)
assert.match(mapShell, /document\.exitFullscreen\(\)/)
assert.match(mapShell, /fullscreenMode === "fallback"/)
assert.match(mapShell, /event\.key === "Escape"/)
assert.match(mapShell, /document\.addEventListener\("fullscreenchange"/)
assert.match(mapShell, /document\.body\.style\.overflow = "hidden"/)
assert.match(mapShell, /document\.body\.style\.overflow = previousOverflow/)
assert.match(mapShell, /map\.invalidateSize\(\{ animate: false, pan: false \}\)/)
assert.match(mapShell, /new ResizeObserver\(handleViewportChange\)/)
assert.match(mapShell, /expandButtonRef\.current\?\.focus\(\)/)
assert.match(mapShell, /fixed inset-0 z-\[1100\] h-\[100dvh\] w-screen bg-background/)
assert.match(mapShell, /Press Esc to return/)

assert.equal((farmMap.match(/<FarmMapOrthomosaic/g) ?? []).length, 1, "fullscreen must retain the existing map instance")
const fullscreenHandler = mapShell.slice(
  mapShell.indexOf("async function toggleMapExpansion"),
  mapShell.indexOf("function fitTo"),
)
assert.doesNotMatch(fullscreenHandler, /setView\(|fitBounds\(/, "fullscreen must not alter map position")
assert.doesNotMatch(fullscreenHandler, /setLayerEnabled\(/, "fullscreen must not alter the orthomosaic layer")

console.log("Farm Map fullscreen control contracts: PASS")
