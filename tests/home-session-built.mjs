import assert from "node:assert/strict"
import fs from "node:fs"
import net from "node:net"
import { spawn } from "node:child_process"
import test from "node:test"

test("built homepage is dynamic, private/no-store, isolated per identity, and fail-closed", { timeout: 60_000 }, async context => {
  const manifest = JSON.parse(fs.readFileSync(".next/prerender-manifest.json", "utf8"))
  assert.equal(manifest.routes["/"], undefined)
  assert.equal(fs.existsSync(".next/server/app/index.html"), false)
  const port = await new Promise(resolve => {
    const socket = net.createServer().listen(0, "127.0.0.1", () => {
      const selected = socket.address().port
      socket.close(() => resolve(selected))
    })
  })
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    env: { ...process.env, NODE_ENV: "production", MFMS_ENV: "production", MFMS_TRUST_PROXY_ACTOR_HEADERS: "true" },
    stdio: "ignore",
  })
  context.after(() => child.kill("SIGTERM"))
  const url = `http://127.0.0.1:${port}/`
  let ready = false
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).status === 200) { ready = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(ready, "built server ready")
  for (const fixture of [1, 2, 1]) {
    const csrf = String(fixture).repeat(43)
    const name = `Fixture <${fixture}>`
    const response = await fetch(url, { headers: {
      "x-mfms-user": "fixture-user", "x-mfms-environment": "production",
      "x-mfms-display-name-b64": Buffer.from(name).toString("base64"), "x-mfms-session-csrf": csrf,
    } })
    assert.equal(response.status, 200)
    const cache = response.headers.get("cache-control") || ""
    assert.match(cache, /(?:^|,)\s*private\b/)
    assert.match(cache, /(?:^|,)\s*no-store\b/)
    assert.doesNotMatch(cache, /\bpublic\b|s-maxage/)
    assert.notEqual(response.headers.get("x-nextjs-cache"), "HIT")
    for (const header of ["x-mfms-session-csrf", "x-mfms-display-name-b64"]) assert.equal(response.headers.get(header), null)
    const body = await response.text()
    assert.match(body, new RegExp(`Fixture &lt;${fixture}&gt;`))
    assert.equal((body.match(/<form\b/g) || []).length, 1)
    assert.equal((body.match(/name="csrf"/g) || []).length, 1)
    assert.match(body, new RegExp(`<input type="hidden" name="csrf" value="${csrf}"`))
    const visible = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, "")
    assert.ok(!visible.includes(csrf))
    assert.ok(![...body.matchAll(/(?:href|action)="([^"]*)"/g)].some(match => match[1].includes(csrf)))
  }
  const response = await fetch(url)
  assert.doesNotMatch(await response.text(), /<form\b|<input[^>]*name="csrf"/)
})
