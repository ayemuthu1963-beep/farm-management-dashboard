import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const mapShell = readFileSync(resolve(root, "components/maps/farm-orthomosaic-map.tsx"), "utf8")
const farmMap = readFileSync(resolve(root, "components/maps/farm-map-client.tsx"), "utf8")
const pipeline = readFileSync(resolve(root, "components/maps/irrigation-pipeline-editor.tsx"), "utf8")

// Shared fullscreen/pipeline behavior is preserved; the current Farm Map uses an isolated shell.
assert.match(farmMap, /<FarmMapOrthomosaic/)
assert.match(farmMap, /fitInitialBounds/)
assert.equal((pipeline.match(/className="md:row-span-2"/g) ?? []).length, 2)

const responsiveLayout = mapShell.slice(mapShell.indexOf('controlsPlacement === "responsive-grid"'))
assert.ok(responsiveLayout.indexOf("{mapPanel}") < responsiveLayout.indexOf('data-testid="farm-map-tile-grid"'))
assert.ok(responsiveLayout.indexOf("{layerControls}") < responsiveLayout.indexOf("{children}"))
assert.ok(responsiveLayout.indexOf("{children}") < responsiveLayout.indexOf("{fitControls}"))

const tileNames = [
  "Raster Layer",
  "Tree Layers & Legend",
  "Irrigation Pipeline",
  "Pipeline Filters",
  "Point ",
  "Tree Correlation",
  "Network Export",
]
for (const tileName of tileNames) {
  assert.ok(mapShell.includes(tileName) || farmMap.includes(tileName) || pipeline.includes(tileName), `${tileName} tile must remain rendered`)
}
for (const [before, after] of [
  ['title="Irrigation Pipeline"', 'title="Pipeline Filters"'],
  ['title="Pipeline Filters"', 'title={manualDraft ? "New Manual Pipeline Node" : `Point '],
  ['title={manualDraft ? "New Manual Pipeline Node" : `Point ', 'title="Tree Correlation"'],
  ['title="Tree Correlation"', 'title="Network Export"'],
]) {
  assert.ok(pipeline.indexOf(before) < pipeline.indexOf(after), `${before} must render before ${after}`)
}

assert.match(mapShell, /aria-label=\{isMapExpanded \? "Exit full screen" : "Expand map"\}/)
assert.match(mapShell, /aria-expanded=\{isMapExpanded\}/)
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

assert.equal((farmMap.match(/<FarmMapOrthomosaic/g) ?? []).length, 1, "Farm Map must retain one map instance")
const fullscreenHandler = mapShell.slice(
  mapShell.indexOf("async function toggleMapExpansion"),
  mapShell.indexOf("function fitTo"),
)
assert.doesNotMatch(fullscreenHandler, /setView\(|fitBounds\(/, "fullscreen must not alter map position")
assert.doesNotMatch(fullscreenHandler, /setLayerEnabled\(/, "fullscreen must not alter layer state")

console.log("Farm Map full-width responsive layout and fullscreen contracts: PASS")
