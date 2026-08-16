import { readFileSync, writeFileSync } from "node:fs"

const packageFile = new URL("../ios/App/CapApp-SPM/Package.swift", import.meta.url)
const source = readFileSync(packageFile, "utf8")
const splashDependency = /\.package\(name: "CapacitorSplashScreen", path: "[^"]+"\)/

if (!splashDependency.test(source)) {
  throw new Error("CapacitorSplashScreen was not found in the generated iOS Package.swift file.")
}

const portableSource = source.replace(
  splashDependency,
  '.package(name: "CapacitorSplashScreen", path: "../../../node_modules/@capacitor/splash-screen")',
)

if (portableSource !== source) {
  writeFileSync(packageFile, portableSource, "utf8")
  console.log("Normalized the iOS Capacitor plugin path for macOS and Windows.")
}
