import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const read = (file) => readFileSync(resolve(process.cwd(), file), "utf8")
const adminPage = read("app/admin/page.tsx")
const registerPage = read("app/inventory-management/page.tsx")
const registerEntryPage = read("app/inventory-management/entry/page.tsx")
const dashboard = read("components/asset-register/asset-register-dashboard-client.tsx")
const entry = read("components/asset-register/asset-register-entry-client.tsx")
const proxy = read("app/api/asset-register/[...path]/route.ts")

assert.doesNotMatch(adminPage, /Fertiliser & Pesticide Inventory Entry/)
assert.match(registerPage, /Farm Asset Register/)
assert.match(registerEntryPage, /Register Farm Asset/)
assert.match(dashboard, /\/api\/asset-register\/dashboard/)
assert.match(entry, /\/api\/asset-register\/assets/)
assert.match(proxy, /\/api\/asset-register\//)

console.log("asset register release checks passed")
