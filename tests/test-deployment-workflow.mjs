import assert from "node:assert/strict"
import fs from "node:fs"

const deployWorkflow = fs.readFileSync(".github/workflows/test-server-deploy.yml", "utf8")
const rollbackWorkflow = fs.readFileSync(".github/workflows/test-server-rollback.yml", "utf8")
const serverProgram = fs.readFileSync("scripts/test-server-deploy.sh", "utf8")

for (const source of [deployWorkflow, rollbackWorkflow]) {
  assert.match(source, /name: Test/)
  assert.match(source, /https:\/\/test\.muthufarms\.com/)
  assert.match(source, /refs\/heads\/main/)
  assert.match(source, /database_identity=mfms_server_test/)
  assert.match(source, /production_touched=0/)
  assert.doesNotMatch(source, /name: Production/)
  assert.doesNotMatch(source, /https:\/\/muthufarms\.com(?:\/|\s|$)/)
}

assert.match(deployWorkflow, /refs\/heads\/test-release/)
assert.match(deployWorkflow, /deploy-test \$CANDIDATE_REVISION \$EXPECTED_CURRENT_REVISION/)
assert.match(rollbackWorkflow, /rollback-test \$CURRENT_REVISION/)

assert.match(serverProgram, /release_ref="refs\/heads\/test-release"/)
assert.match(serverProgram, /expected_database="mfms_server_test"/)
assert.match(serverProgram, /bridge_container="mfms-test-upstream-bridge"/)
assert.match(serverProgram, /expected_bridge_ip="172\.19\.0\.14"/)
assert.match(serverProgram, /candidate does not contain the live Test baseline/)
assert.match(serverProgram, /a non-Test-frontend container changed/)
assert.match(serverProgram, /TEST_HEALTH_FAILURE_REHEARSAL=PASS/)
assert.equal((serverProgram.match(/mfms_server_prod/g) ?? []).length, 1)
assert.match(serverProgram, /a Production database alias is present in the Test runtime environment/)
assert.doesNotMatch(serverProgram, /nginx -s reload/)
assert.doesNotMatch(serverProgram, /docker (exec|restart) central-nginx/)

console.log("Test deployment workflow safety checks passed")
