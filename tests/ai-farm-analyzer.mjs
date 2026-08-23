import assert from "node:assert/strict"
import { readFileSync } from "node:fs"


const route = readFileSync("app/api/ai-analyzer/route.ts", "utf8")
const page = readFileSync("app/ai-farm-analyzer/page.tsx", "utf8")
const client = readFileSync("components/ai-analyzer/ai-analyzer-client.tsx", "utf8")
const navigation = readFileSync("lib/mfms-navigation.ts", "utf8")
const types = readFileSync("lib/ai-analyzer-types.ts", "utf8")

assert.match(navigation, /id: "ai-farm-analyzer"/)
assert.match(navigation, /href: "\/ai-farm-analyzer"/)
assert.match(page, /AI Farm Analyzer/)
assert.match(page, /AiAnalyzerClient/)

assert.match(route, /new Set\(\["preview", "uat"\]\)/)
assert.match(route, /getAuthenticatedUserAssertionHeaders/)
assert.match(route, /method: "GET"/)
assert.match(route, /export async function POST/)
assert.match(route, /method: "POST"/)
assert.match(route, /alerts\/\$\{encodeURIComponent\(requestBody\.alert_id\)\}\/explanation/)
assert.match(route, /JSON\.stringify\(\{ evidence_hash: requestBody\.evidence_hash \}\)/)
assert.match(route, /cache: "no-store"/)
assert.match(route, /response\.body\?\.getReader\(\)/)
assert.match(route, /totalBytes > RESPONSE_LIMIT_BYTES/)
assert.match(route, /reader\.cancel\(/)
assert.doesNotMatch(route, /response\.arrayBuffer\(\)/)
assert.match(route, /value\.read_only === true/)
assert.doesNotMatch(route, /alerts\/bulk|generate-all|reset-validation/i)

assert.equal((client.match(/method: "POST"/g) ?? []).length, 1, "only the explicit generate action may POST")
assert.match(client, /Generate AI explanation/)
assert.match(client, /if \(!data\?\.ai_enabled \|\| generatingId\) return/)
assert.match(client, /body: JSON\.stringify\(\{ alert_id: alert\.alert_id, evidence_hash: alert\.evidence_hash \}\)/)
assert.doesNotMatch(client.slice(client.indexOf("const refresh"), client.indexOf("const generateExplanation")), /method: "POST"/)

for (const requiredText of [
  "Data as of — every source",
  "Overall farm status",
  "Alert filters",
  "Deterministic evidence",
  "AI explanation",
  "Deterministic fallback explanation",
  "Suggested field checks",
  "Clear filters",
  "Refresh",
  "Crop",
  "Plot",
  "Zone",
  "Severity",
  "Date",
  "Advisory checks only",
  "no database access or control actions",
]) assert.match(client, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))

assert.match(types, /source_timestamp: string \| null/)
assert.match(types, /deterministic_condition: string/)
assert.match(types, /evidence_values: AnalyzerEvidenceValue\[\]/)
assert.match(types, /deterministic_fallback_explanation: string/)
assert.match(types, /model_name: string \| null/)
assert.match(types, /prompt_version: string \| null/)
assert.match(types, /read_only: true/)

console.log("AI Farm Analyzer frontend contract tests passed")
