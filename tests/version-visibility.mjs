import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const route = await readFile("app/api/version/route.ts", "utf8")
const dockerfile = await readFile("Dockerfile.preview", "utf8")
const dockerignore = await readFile(".dockerignore", "utf8")
const exampleEnvironment = await readFile(".env.example", "utf8")

for (const field of ["git_commit", "build_timestamp", "environment"]) {
  assert.ok(route.includes(field), `Version route is missing ${field}`)
}

assert.match(route, /Cache-Control": "no-store"/)
assert.match(dockerfile, /pnpm@10\.34\.5/)
assert.match(dockerfile, /pnpm install --frozen-lockfile/)
assert.match(dockerfile, /org\.opencontainers\.image\.revision/)
assert.match(dockerfile, /MFMS_GIT_COMMIT/)
assert.match(dockerignore, /^\.env$/m)
assert.match(dockerignore, /^node_modules$/m)
assert.match(dockerignore, /^\.next$/m)
assert.match(dockerignore, /^\*\.apk$/m)
assert.doesNotMatch(exampleEnvironment, /gho_|github_pat_|BEGIN (RSA |OPENSSH )?PRIVATE KEY/)

console.log("Version visibility and reproducible Docker build: PASS")
