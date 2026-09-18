import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import Module, { createRequire } from "node:module"
import test from "node:test"
import ts from "typescript"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { resolveHomeSession } from "../lib/home-session.ts"

const environment = { MFMS_ENV: "production", MFMS_TRUST_PROXY_ACTOR_HEADERS: "true" }
const csrf = "a".repeat(43)
const headers = (overrides = {}) => new Headers({
  "x-mfms-environment": "production", "x-mfms-user": "fixture-user",
  "x-mfms-session-csrf": csrf,
  "x-mfms-display-name-b64": Buffer.from("தமிழ் 🌾 <fixture>").toString("base64"),
  ...overrides,
})
const componentPath = path.resolve("components/home/home-header.tsx")
const compiled = ts.transpileModule(fs.readFileSync(componentPath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText
const component = new Module(componentPath)
component.filename = componentPath
component.paths = createRequire(componentPath).resolve.paths("react")
component._compile(compiled, componentPath)
const { HomeHeader } = component.exports
const render = session => renderToStaticMarkup(React.createElement(HomeHeader, session))

test("valid trusted metadata renders escaped Unicode beside navigation and a single hidden CSRF", () => {
  const session = resolveHomeSession(headers(), environment)
  assert.equal(session.displayName, "தமிழ் 🌾 <fixture>")
  const html = render(session)
  assert.match(html, /தமிழ் 🌾 &lt;fixture&gt;/)
  assert.equal((html.match(/<form\b/g) || []).length, 1)
  assert.match(html, /<form action="https:\/\/auth\.muthufarms\.com\/logout" method="post">/)
  assert.equal((html.match(/name="csrf"/g) || []).length, 1)
  assert.match(html, new RegExp(`<input type="hidden" name="csrf" value="${csrf}"`))
  assert.ok(!html.replace(/<[^>]+>/g, "").includes(csrf))
  assert.ok(![...html.matchAll(/(?:href|action)="([^"]*)"/g)].some(match => match[1].includes(csrf)))
})

test("missing display name falls back to the validated username", () => {
  const h = headers(); h.delete("x-mfms-display-name-b64")
  assert.equal(resolveHomeSession(h, environment).displayName, "fixture-user")
})

test("malformed/noncanonical Base64, invalid UTF-8, controls and oversized names fall back", () => {
  for (const value of ["!", "Zg", "Zh==", "Zg===", "Zg==,Zg==", Buffer.from([0xc0, 0xaf]).toString("base64"),
    ...["", "   ", "a\u0000b", "a\u0085b", "x".repeat(129)].map(name => Buffer.from(name).toString("base64")), "A".repeat(688)]) {
    assert.equal(resolveHomeSession(headers({ "x-mfms-display-name-b64": value }), environment).displayName, "fixture-user")
  }
})

test("display name is decoded exactly once and never interpreted as HTML", () => {
  const once = Buffer.from("still-encoded").toString("base64")
  assert.equal(resolveHomeSession(headers({ "x-mfms-display-name-b64": Buffer.from(once).toString("base64") }), environment).displayName, once)
})

test("missing/invalid CSRF never produces an actionable logout form", () => {
  for (const value of [null, "", "x".repeat(42), "x".repeat(44), "x".repeat(42) + "+", "x".repeat(42) + "=", csrf + "," + csrf]) {
    const h = headers(); value === null ? h.delete("x-mfms-session-csrf") : h.set("x-mfms-session-csrf", value)
    const session = resolveHomeSession(h, environment)
    assert.equal(session.csrf, null)
    assert.doesNotMatch(render(session), /<form\b|name="csrf"/)
  }
})

test("untrusted/mismatched gateways and invalid usernames fail closed", () => {
  for (const env of [{}, { ...environment, MFMS_TRUST_PROXY_ACTOR_HEADERS: "false" }, { ...environment, MFMS_ENV: "preview" }]) {
    assert.deepEqual(resolveHomeSession(headers(), env), { displayName: null, csrf: null })
  }
  for (const overrides of [{ "x-mfms-environment": "preview" }, { "x-mfms-user": "" }, { "x-mfms-user": "x".repeat(129) }]) {
    assert.deepEqual(resolveHomeSession(headers(overrides), environment), { displayName: null, csrf: null })
  }
})

test("server page explicitly opts out of prerender and awaits gateway headers", () => {
  const source = fs.readFileSync("app/page.tsx", "utf8")
  assert.match(source, /export const dynamic = "force-dynamic"/)
  assert.match(source, /export const revalidate = 0/)
  assert.match(source, /resolveHomeSession\(await headers\(\)\)/)
  assert.doesNotMatch(source, /use client|localStorage|cookies\(/)
})
