import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const workflow = readFileSync(".github/workflows/preview-server-preflight.yml", "utf8")
const script = readFileSync("scripts/preview-server-preflight.sh", "utf8")

assert.match(workflow, /^\s*workflow_dispatch:/m)
assert.doesNotMatch(workflow, /^\s*(push|pull_request|schedule):/m)
assert.match(workflow, /^permissions:\n\s+contents: read$/m)
assert.match(workflow, /^\s+environment: preview$/m)
assert.match(workflow, /\[\[ "\$CONFIRMATION" == "INSPECT PREVIEW ONLY" \]\]/)
assert.match(workflow, /\[\[ "\$WORKFLOW_REF" == "refs\/heads\/main" \]\]/)
assert.match(workflow, /^\s+needs: authorize$/m)
assert.match(workflow, /StrictHostKeyChecking=yes/)
assert.match(workflow, /BatchMode=yes/)
assert.match(workflow, /persist-credentials: false/)
assert.doesNotMatch(workflow, /ssh-keyscan/)
assert.doesNotMatch(workflow, /uses:\s+[^\s]+@v\d+/)
assert.match(workflow, /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/)
assert.match(workflow, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/)

for (const variableName of ["PREVIEW_SSH_HOST", "PREVIEW_SSH_USER"]) {
  assert.match(workflow, new RegExp(`vars\\.${variableName}`))
  assert.doesNotMatch(workflow, new RegExp(`secrets\\.${variableName}`))
}

for (const secretName of [
  "PREVIEW_SSH_PRIVATE_KEY",
  "PREVIEW_SSH_KNOWN_HOSTS",
]) {
  assert.match(workflow, new RegExp(`secrets\\.${secretName}`))
}

assert.match(script, /root SSH access is prohibited/)
assert.match(script, /the approved Preview SSH user is muthu/)
assert.match(script, /the SSH key is restricted to the Preview preflight command/)
assert.match(script, /READ_ONLY_PREFLIGHT=PASS/)
assert.match(script, /production_containers_touched=0/)
assert.match(script, /backend_containers_changed=0/)
assert.match(script, /database_operations=0/)
assert.match(script, /odk_operations=0/)
assert.match(script, /scheduler_operations=0/)
assert.match(script, /proxy_configuration_operations=0/)

for (const prohibited of [
  /docker\s+(rm|stop|kill|restart|run|create|rename|update)\b/,
  /docker\s+compose\s+(up|down|restart)\b/,
  /\bsudo\b/,
  /\b(crontab\s+-r|systemctl\s+(stop|restart)|service\s+\S+\s+(stop|restart))\b/,
]) {
  assert.doesNotMatch(script, prohibited)
}

console.log("Preview deployment preflight workflow tests passed.")
