import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

const page = read("app/fertiliser-management/page.tsx")
const api = read("lib/fertiliser-api.ts")
const data = read("lib/fertiliser-data.ts")

assert.match(api, /purchase_total_cost: string/)
assert.match(api, /unit_cost: string \| null/)
assert.match(api, /latest_unit_cost: string \| null/)
assert.match(api, /latest_purchase_date: string \| null/)

assert.match(page, /function calculateUnitPrice\(totalCost: string, quantity: string\)/)
assert.match(page, /function validatePurchaseTotalCost\(value: string\)/)
assert.match(page, /purchase_total_cost: purchaseTotalCost/)
assert.equal((page.match(/name="purchaseTotalCost"/g) ?? []).length, 2)
assert.equal((page.match(/Total purchase cost \(₹\)/g) ?? []).length, 2)
assert.match(page, /Calculated price per \{incomingUnit \|\| "unit"\}/)
assert.match(page, /Calculated price per \{item\.unit\}/)

assert.match(page, />Latest Price \/ Unit</)
assert.match(page, />Latest Purchase</)
assert.match(page, />Total Cost</)
assert.match(page, />Price \/ Unit</)
assert.match(page, /formatTransactionPurchaseCost\(txn\)/)
assert.match(page, /formatTransactionUnitPrice\(txn\)/)
assert.match(page, /transaction\.transaction_type !== "INCOMING"/)

assert.match(data, /latestPurchaseTotalCost\?: string \| null/)
assert.match(data, /latestPurchaseUnitCost\?: string \| null/)
assert.match(data, /latestPurchaseDate\?: string \| null/)

console.log("Fertiliser purchase-cost frontend contract checks passed.")
