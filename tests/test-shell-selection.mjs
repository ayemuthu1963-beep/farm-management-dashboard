import assert from "node:assert/strict"
import { selectTestBash } from "./select-test-bash.mjs"

function fixture(overrides = {}) {
  const calls = []
  const settings = {
    platform: "linux", environment: {}, realpath: value => value,
    stat: () => ({ isFile: () => true }), access: () => {},
    spawn: (...args) => { calls.push(args); return { status: 0, signal: null, stdout: "GNU bash, version 5.2.15(1)-release\n" } },
    ...overrides,
  }
  return { settings, calls }
}

export function runShellSelectionTests() {
  let count = 0
  const linux = fixture()
  assert.equal(selectTestBash(linux.settings), "/bin/bash")
  assert.equal(linux.calls.length, 1)
  assert.deepEqual(linux.calls[0][1], ["--noprofile", "--norc", "--version"])
  assert.equal(linux.calls[0][2].shell, false)
  count++

  const exactPath = "C:\\tools\\GNU Bash\\bash.exe"
  const environment = { MFMS_TEST_BASH: exactPath, BASH_ENV: "must-not-run", ENV: "must-not-run", bAsH_EnV: "must-not-run", KEEP: "unchanged" }
  const windows = fixture({ platform: "win32", environment })
  assert.equal(selectTestBash(windows.settings), exactPath)
  assert.equal(windows.calls[0][0], exactPath)
  assert.deepEqual(windows.calls[0][2].env, { MFMS_TEST_BASH: exactPath, KEEP: "unchanged", LC_ALL: "C" })
  assert.equal(environment.BASH_ENV, "must-not-run")
  count++

  for (const selected of [undefined, "", "bash", "C:bash.exe", "\\bash.exe", "\\\\server\\share\\bash.exe", "\\\\?\\C:\\tools\\bash.exe",
    "C:\\Windows\\System32\\bash.exe", "c:/WINDOWS/system32/../System32/BASH.EXE", "C:\\Windows\\Sysnative\\bash.exe", "C:\\Windows\\System32\\wsl.exe"]) {
    const item = fixture({ platform: "win32", environment: selected === undefined ? {} : { MFMS_TEST_BASH: selected } })
    assert.throws(() => selectTestBash(item.settings), /Test Bash setup failed/)
    assert.equal(item.calls.length, 0, "invalid selection must not launch a child or try a fallback")
    count++
  }
  const alias = fixture({ platform: "win32", environment: { MFMS_TEST_BASH: exactPath }, realpath: () => "C:\\Windows\\SYSTEM32\\bash.exe" })
  assert.throws(() => selectTestBash(alias.settings), /WSL launcher/)
  assert.equal(alias.calls.length, 0)
  count++

  for (const override of [
    { environment: { MFMS_TEST_BASH: "relative/bash" } },
    { realpath: () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }) } },
    { stat: () => ({ isFile: () => false }) },
    { access: () => { throw Object.assign(new Error("not executable"), { code: "EACCES" }) } },
    { platform: "unsupported" },
  ]) {
    const item = fixture(override)
    assert.throws(() => selectTestBash(item.settings), /Test Bash setup failed/)
    assert.equal(item.calls.length, 0)
    count++
  }

  for (const response of [
    { status: 1, stdout: "GNU bash, version 5.2" },
    { status: 0, signal: "SIGTERM", stdout: "GNU bash, version 5.2" },
    { status: null, error: new Error("spawn failed") },
    { status: 0, stdout: "GNU bash, version 3.2.57" },
    { status: 0, stdout: "busybox sh 5.2" },
    { status: 0, stdout: "GNU bash, version unknown" },
    { status: 0, stdout: null },
  ]) {
    let attempts = 0
    const item = fixture({ spawn: () => { attempts++; return response } })
    assert.throws(() => selectTestBash(item.settings), /Test Bash setup failed/)
    assert.equal(attempts, 1, "a failed probe must not trigger another shell")
    count++
  }
  return count
}

// Every dependency is injected: importing this regression file launches no shell.
console.log(`Test Bash selection regressions: ${runShellSelectionTests()} cases passed; real subprocesses=0`)
