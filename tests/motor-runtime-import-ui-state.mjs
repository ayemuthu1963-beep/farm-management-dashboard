import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const component = readFileSync(new URL("../components/admin/motor-runtime-management-client.tsx", import.meta.url), "utf8")

assert.match(component, /const query = useCallback\(\(pageSize: 200 \| 500\)/)
assert.match(component, /loadAllEvents\(query\(500\)\)/)
assert.match(component, /const params = query\(200\)/)
assert.doesNotMatch(component, /setRuns\(\(current\) => \[\.\.\.current, \.\.\.nextRuns\]\)/)
assert.match(component, /setRuns\(nextRuns\)/)
assert.match(component, /function startNewImport\(\)/)
assert.match(component, /setImports\(\[\]\)/)
assert.match(component, /setRuns\(\[\]\)/)
assert.match(component, /Start New Import/)
assert.match(component, /setError\(null\)\s+patch\(run\.key, \{ saving: true/)
assert.match(component, /patch: \(key: string, value: Partial<EditableRun>\) => void = patchRun/)

console.log("Motor Runtime history page-size, clean new-import state and stale-error safeguards: PASS")
