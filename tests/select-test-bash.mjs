import { spawnSync } from "node:child_process"
import { accessSync, constants, realpathSync, statSync } from "node:fs"
import { posix, win32 } from "node:path"

const refused = detail => { throw new Error(`Test Bash setup failed: ${detail}`) }

function validatePath(value, platform) {
  if (typeof value !== "string" || value.includes("\0")) refused("an absolute executable path is required")
  if (platform === "win32") {
    // Drive-relative, root-relative, UNC and device paths are not supported.
    if (!/^[a-z]:[\\/]/i.test(value) || !win32.isAbsolute(value)) refused("Windows requires an absolute drive path")
    const normalized = win32.normalize(value).toLowerCase()
    if (/\\(?:system32|sysnative|syswow64)\\(?:bash|wsl)(?:\.exe)?$/.test(normalized)) {
      refused("the Windows WSL launcher is not a test Bash executable")
    }
  } else if (!posix.isAbsolute(value)) {
    refused("an absolute executable path is required")
  }
}

export function selectTestBash({
  platform = process.platform,
  environment = process.env,
  realpath = realpathSync,
  stat = statSync,
  access = accessSync,
  spawn = spawnSync,
} = {}) {
  if (platform !== "linux" && platform !== "win32") refused("unsupported test platform")
  const overridePresent = Object.hasOwn(environment, "MFMS_TEST_BASH")
  if (platform === "win32" && !overridePresent) refused("set MFMS_TEST_BASH to an explicit absolute GNU Bash executable")
  const selected = overridePresent ? environment.MFMS_TEST_BASH : "/bin/bash"
  validatePath(selected, platform)
  try {
    const resolved = realpath(selected)
    validatePath(resolved, platform)
    if (!stat(resolved).isFile()) refused("selected executable is not a regular file")
    access(resolved, constants.X_OK)
  } catch (error) {
    refused(`executable validation failed (${error.code || error.message})`)
  }
  // Version probing must not source user startup scripts or invoke another shell.
  const probeEnvironment = { ...environment, LC_ALL: "C" }
  for (const key of Object.keys(probeEnvironment)) {
    if (["BASH_ENV", "ENV"].includes(key.toUpperCase())) delete probeEnvironment[key]
  }
  const result = spawn(selected, ["--noprofile", "--norc", "--version"], {
    encoding: "utf8", shell: false, env: probeEnvironment, timeout: 10000, windowsHide: true,
  })
  if (result.error || result.signal || result.status !== 0) refused("GNU Bash version probe did not complete successfully")
  const match = typeof result.stdout === "string" && /^GNU bash, version ([0-9]+)\.[0-9]+/m.exec(result.stdout)
  if (!match || Number(match[1]) < 4) refused("GNU Bash version 4 or newer is required")
  return selected
}
