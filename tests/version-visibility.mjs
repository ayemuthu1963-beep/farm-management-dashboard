import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const route = await readFile("app/api/version/route.ts", "utf8")
const dockerfile = await readFile("Dockerfile.preview", "utf8")
const dockerignore = await readFile(".dockerignore", "utf8")
const exampleEnvironment = await readFile(".env.example", "utf8")
const layout = await readFile("app/layout.tsx", "utf8")
const globalStyles = await readFile("app/globals.css", "utf8")
const packageJson = await readFile("package.json", "utf8")

for (const field of [
  "git_commit",
  "git_branch",
  "build_timestamp",
  "environment",
  "deployment_id",
]) {
  assert.ok(route.includes(field), `Version route is missing ${field}`)
}

assert.match(route, /Cache-Control": "no-store"/)
assert.match(route, /VERCEL_GIT_COMMIT_SHA/)
assert.match(route, /VERCEL_GIT_COMMIT_REF/)
assert.match(route, /VERCEL_DEPLOYMENT_ID/)
assert.match(route, /Vercel Preview/)
assert.match(route, /Vercel Production Target/)
assert.doesNotMatch(layout, /next\/font\/google/)
assert.match(layout, /@fontsource-variable\/inter/)
assert.match(layout, /@fontsource\/merriweather\/latin-700\.css/)
assert.match(layout, /@fontsource\/merriweather\/latin-900\.css/)
assert.match(globalStyles, /'Inter Variable'/)
assert.match(globalStyles, /'Merriweather'/)
assert.match(packageJson, /"@fontsource-variable\/inter": "5\.3\.0"/)
assert.match(packageJson, /"@fontsource\/merriweather": "5\.3\.0"/)
assert.match(dockerfile, /pnpm@10\.34\.5/)
assert.match(dockerfile, /pnpm install --frozen-lockfile/)
assert.match(dockerfile, /org\.opencontainers\.image\.revision/)
assert.match(dockerfile, /MFMS_GIT_COMMIT/)
assert.match(dockerfile, /"pnpm", "exec", "next", "start"/)
assert.doesNotMatch(dockerfile, /"pnpm", "start", "--"/)
assert.match(dockerignore, /^\.env$/m)
assert.match(dockerignore, /^node_modules$/m)
assert.match(dockerignore, /^\.next$/m)
assert.match(dockerignore, /^\*\.apk$/m)
assert.doesNotMatch(exampleEnvironment, /gho_|github_pat_|BEGIN (RSA |OPENSSH )?PRIVATE KEY/)

console.log("Version visibility and reproducible Docker build: PASS")
