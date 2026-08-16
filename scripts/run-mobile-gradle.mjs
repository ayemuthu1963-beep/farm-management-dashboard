import { existsSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import process from "node:process"

const supportedTasks = new Set([
  "clean",
  "assembleDebug",
  "assembleRelease",
  "bundleRelease",
  "lintDebug",
  "lintRelease",
  "testDebugUnitTest",
  "testReleaseUnitTest",
])
const tasks = process.argv.slice(2)

if (tasks.length === 0 || tasks.some((task) => !supportedTasks.has(task))) {
  console.error(`Choose one or more supported Gradle tasks: ${[...supportedTasks].join(", ")}`)
  process.exit(2)
}

const environment = { ...process.env }

if (process.platform === "win32") {
  const javaHome = join(environment.ProgramFiles || "C:\\Program Files", "Android", "Android Studio", "jbr")
  const androidHome = join(environment.LOCALAPPDATA || "", "Android", "Sdk")

  if (!environment.JAVA_HOME && existsSync(javaHome)) environment.JAVA_HOME = javaHome
  if (!environment.ANDROID_HOME && existsSync(androidHome)) environment.ANDROID_HOME = androidHome
}

if (!environment.JAVA_HOME) {
  console.error("JAVA_HOME is not configured. Use Android Studio's bundled Java 21 runtime.")
  process.exit(2)
}

if (!environment.ANDROID_HOME) {
  console.error("ANDROID_HOME is not configured. Point it to the installed Android SDK.")
  process.exit(2)
}

const executable = process.platform === "win32" ? "gradlew.bat" : "./gradlew"
const result = spawnSync(executable, tasks, {
  cwd: new URL("../android/", import.meta.url),
  env: environment,
  shell: process.platform === "win32",
  stdio: "inherit",
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
