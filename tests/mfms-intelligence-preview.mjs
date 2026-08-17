import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const route = readFileSync("app/api/intelligence/ask/route.ts", "utf8")
const page = readFileSync("components/intelligence/intelligence-client.tsx", "utf8")
const navigation = readFileSync("lib/mfms-navigation.ts", "utf8")

assert.match(route, /fields\.length !== 1/)
assert.match(route, /MAX_QUESTION_CHARACTERS = 500/)
assert.match(route, /getAuthenticatedUserAssertionHeaders/)
assert.match(route, /cache: "no-store"/)
assert.match(route, /table_rows/)
assert.match(route, /response\.table_rows\.length <= 10/)
assert.doesNotMatch(route, /OPENAI_API_KEY|METABASE_API_KEY|postgresql:\/\//i)
assert.match(page, /Average coconuts per harvested tree/)
assert.match(page, /Top 10 coconut producing trees/)
assert.match(page, /Avg Nuts \/ Harvested Record/)
assert.match(page, /overflow-x-auto/)
assert.match(page, /result\.table_rows\.map/)
assert.match(page, /Quality flags/)
assert.match(page, /Eligible-tree, missed-harvest, classification, previous-10/)
assert.doesNotMatch(page, /dangerouslySetInnerHTML/)
assert.match(navigation, /id: "mfms-intelligence"/)
console.log("MFMS Preview Intelligence contract tests passed")
