import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const motorCards = readFileSync("components/motor/motor-status-cards.tsx", "utf8")
const zoneCards = readFileSync("components/irrigation/zone-status-cards.tsx", "utf8")
const proxyRoute = readFileSync("app/api/operator-settings/[[...path]]/route.ts", "utf8")
const settingsContract = readFileSync("lib/operator-settings.ts", "utf8")
const irrigationPlan = readFileSync("components/irrigation/irrigation-plan-tables.tsx", "utf8")

assert.match(motorCards, /fetch\("\/api\/operator-settings"/)
assert.match(motorCards, /method: "PUT"/)
assert.match(motorCards, /saveMotorSettings\(motor\.id\)/)
assert.match(motorCards, /parseMotorSettings\(payload\.values\)/)

assert.match(zoneCards, /fetch\("\/api\/operator-settings"/)
assert.match(zoneCards, /irrigation-targets\/\$\{zoneId\}/)
assert.match(zoneCards, /saveTarget\(zone\.id\)/)
assert.match(zoneCards, /maxLength=\{120\}/)

assert.match(proxyRoute, /\/api\/operator-settings/)
assert.match(proxyRoute, /method: "GET" \| "PUT"/)
assert.match(proxyRoute, /cache: "no-store"/)
assert.match(proxyRoute, /irrigation-plan/)

assert.match(irrigationPlan, /fetch\("\/api\/operator-settings\/irrigation-plan\/drip-output"/)
assert.match(irrigationPlan, /fetch\("\/api\/operator-settings\/irrigation-plan\/motor-run-schedule"/)
assert.match(irrigationPlan, /method: "PUT"/)
assert.match(irrigationPlan, /dripSaving\.current/)
assert.match(irrigationPlan, /scheduleSaving\.current/)
assert.match(irrigationPlan, /setSavedDrip/)
assert.match(irrigationPlan, /setSavedSchedule/)

assert.match(settingsContract, /function nullableNumber/)
assert.match(settingsContract, /if \(!value\.trim\(\)\) return null/)
assert.match(settingsContract, /Array\.from\(\{ length: 4 \}/)

console.log("operator settings persistence contract tests passed")
