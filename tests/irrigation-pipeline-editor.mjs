import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  nearestPipelineTrees,
  pipelineDistanceMetres,
} from "../lib/irrigation-pipeline-geometry.ts"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const editor = readFileSync(resolve(root, "components/maps/irrigation-pipeline-editor.tsx"), "utf8")
const farmMap = readFileSync(resolve(root, "components/maps/farm-map-client.tsx"), "utf8")
const proxy = readFileSync(resolve(root, "app/api/irrigation-pipeline/[[...path]]/route.ts"), "utf8")
const signing = readFileSync(resolve(root, "lib/irrigation-pipeline-signing.ts"), "utf8")

assert.ok(editor.includes("Irrigation Pipeline"))
assert.ok(farmMap.includes("<IrrigationPipelineEditor"), "pipeline editor must extend the existing Farm Map")
assert.ok(editor.includes('disabled={!canEdit}'), "Edit mode must be gated by server capabilities")
assert.ok(editor.includes("Enable Edit"))
assert.ok(editor.includes("Original surveyed position"))
assert.ok(editor.includes("#fde047"), "selection and drawing need a strong yellow highlight")
assert.ok(editor.includes("Copy filename") || editor.includes("navigator.clipboard.writeText"))
assert.ok(editor.includes("Reset surveyed"))
assert.ok(editor.includes("Next unverified"))
assert.ok(editor.includes("Split at node"))
assert.ok(editor.includes("Warnings never change network data"))
assert.ok(editor.includes('type="number"'), "pipe size must permit custom numeric input")
assert.ok(proxy.includes("/api/irrigation-pipeline"))
assert.ok(signing.includes('requestHeaders.get("x-mfms-role")'))
assert.ok(!signing.includes("MFMS_WORKER_PROXY_DEFAULT_ROLE"), "pipeline role must come from authenticated proxy identity")

for (const source of [editor, farmMap, proxy, signing]) {
  assert.equal(/https?:\/\/[^"'`\s]+/i.test(source), false, "pipeline code must not embed external media URLs")
  assert.equal(/[A-Za-z]:\\/.test(source), false, "pipeline code must not embed Windows paths")
}

const moved = pipelineDistanceMetres(10.481, 77.078, 10.4811, 77.078)
assert.ok(moved > 11 && moved < 11.2)

const nearest = nearestPipelineTrees(10.481, 77.078, [
  { treeNo: "35.1", plot: "Plot 1", latitude: 10.48101, longitude: 77.078 },
  { treeNo: "36", plot: "Plot 1", latitude: 10.482, longitude: 77.078 },
])
assert.equal(nearest[0].treeNo, "35.1", "decimal TreeNo identifiers must remain exact strings")
assert.ok(nearest[0].distance < nearest[1].distance)

console.log("Irrigation Pipeline Farm Map editor checks passed")
