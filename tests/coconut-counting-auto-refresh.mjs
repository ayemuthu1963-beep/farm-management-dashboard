import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  COCONUT_COUNTING_REFRESH_INTERVAL_MS,
  createCoconutCountingRefreshController,
} from "../lib/coconut-counting-refresh.ts"

class FakeRefreshEnvironment {
  nowMs = 0
  visible = true
  online = true
  nextTimerId = 1
  timers = new Map()
  visibilityListeners = new Set()
  onlineListeners = new Set()

  now = () => this.nowMs

  setTimer = (callback, delayMs) => {
    const id = this.nextTimerId++
    this.timers.set(id, { callback, dueAt: this.nowMs + delayMs })
    return id
  }

  clearTimer = (id) => {
    this.timers.delete(id)
  }

  isVisible = () => this.visible
  isOnline = () => this.online

  onVisibilityChange = (callback) => {
    this.visibilityListeners.add(callback)
    return () => this.visibilityListeners.delete(callback)
  }

  onOnline = (callback) => {
    this.onlineListeners.add(callback)
    return () => this.onlineListeners.delete(callback)
  }

  async advanceBy(delayMs) {
    const target = this.nowMs + delayMs
    while (true) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.dueAt <= target)
        .sort((left, right) => left[1].dueAt - right[1].dueAt || left[0] - right[0])[0]
      if (!next) break
      const [id, timer] = next
      this.timers.delete(id)
      this.nowMs = timer.dueAt
      timer.callback()
      await flushPromises()
    }
    this.nowMs = target
    await flushPromises()
  }

  async setVisible(visible) {
    this.visible = visible
    for (const listener of this.visibilityListeners) listener()
    await flushPromises()
  }

  async setOnline(online) {
    this.online = online
    if (online) {
      for (const listener of this.onlineListeners) listener()
    }
    await flushPromises()
  }
}

async function flushPromises() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve()
  }
}

function immediateRefreshHarness() {
  const environment = new FakeRefreshEnvironment()
  let refreshCount = 0
  const controller = createCoconutCountingRefreshController({
    environment,
    refresh: () => {
      refreshCount += 1
    },
  })
  controller.start()
  return { environment, controller, refreshCount: () => refreshCount }
}

assert.equal(COCONUT_COUNTING_REFRESH_INTERVAL_MS, 300000)

{
  const harness = immediateRefreshHarness()
  await harness.environment.advanceBy(299999)
  assert.equal(harness.refreshCount(), 0, "must not refresh before five minutes")
  await harness.environment.advanceBy(1)
  assert.equal(harness.refreshCount(), 1, "must refresh once at five minutes")
  await harness.environment.advanceBy(600000)
  assert.equal(harness.refreshCount(), 3, "must repeat every five minutes")
  harness.controller.stop()
}

{
  const environment = new FakeRefreshEnvironment()
  let refreshCount = 0
  let resolveRefresh
  const controller = createCoconutCountingRefreshController({
    environment,
    refresh: () => {
      refreshCount += 1
      return new Promise((resolve) => {
        resolveRefresh = resolve
      })
    },
  })
  controller.start()
  await environment.advanceBy(300000)
  assert.equal(refreshCount, 1)
  await environment.advanceBy(300000)
  assert.equal(refreshCount, 1, "must not overlap an in-flight refresh")
  resolveRefresh()
  await flushPromises()
  assert.equal(refreshCount, 2, "must catch up after the in-flight refresh completes")
  controller.stop()
}

{
  const harness = immediateRefreshHarness()
  harness.controller.setCloseInProgress(true)
  await harness.environment.advanceBy(300000)
  assert.equal(harness.refreshCount(), 0, "must skip refresh while Close is running")
  harness.controller.setCloseInProgress(false)
  await flushPromises()
  assert.equal(harness.refreshCount(), 1, "must catch up after Close finishes")
  harness.controller.stop()
}

{
  const harness = immediateRefreshHarness()
  harness.controller.stop()
  await harness.environment.advanceBy(600000)
  assert.equal(harness.refreshCount(), 0, "must clear the timer on unmount")
  assert.equal(harness.environment.visibilityListeners.size, 0)
  assert.equal(harness.environment.onlineListeners.size, 0)
}

{
  const harness = immediateRefreshHarness()
  await harness.environment.setVisible(false)
  await harness.environment.advanceBy(300000)
  assert.equal(harness.refreshCount(), 0)
  await harness.environment.setVisible(true)
  assert.equal(harness.refreshCount(), 1, "must catch up when a suspended tab becomes visible")
  harness.controller.stop()
}

{
  const harness = immediateRefreshHarness()
  await harness.environment.setOnline(false)
  await harness.environment.advanceBy(300000)
  assert.equal(harness.refreshCount(), 0)
  await harness.environment.setOnline(true)
  assert.equal(harness.refreshCount(), 1, "must catch up when connectivity returns")
  harness.controller.stop()
}

const layout = readFileSync("app/coconut-counting/layout.tsx", "utf8")
const page = readFileSync("app/coconut-counting/page.tsx", "utf8")
const provider = readFileSync("components/coconut-counting/auto-refresh.tsx", "utf8")
const controls = readFileSync("components/coconut-counting/session-controls.tsx", "utf8")

assert.match(layout, /CoconutCountingRefreshProvider/)
assert.match(page, /RefreshCw/)
assert.match(page, />\s*Apply\s*</)
assert.match(provider, /router\.refresh\(\)/)
assert.doesNotMatch(provider, /location\.reload|window\.location/)
assert.match(controls, /setCloseInProgress\(true\)/)
assert.match(controls, /setCloseInProgress\(false\)/)
assert.match(controls, /Close Session/)

console.log("Coconut Counting five-minute automatic refresh: PASS")
