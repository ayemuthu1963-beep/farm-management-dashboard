import assert from "node:assert/strict"
import fs from "node:fs"
import { spawnSync } from "node:child_process"
import ts from "typescript"

const expressions = ["components/home/home-header.tsx", "components/farm/sidebar.tsx"].map(file => {
  const source = fs.readFileSync(file, "utf8")
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const values = {}
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ["dateText", "timeText", "liveDate", "liveTime"].includes(node.name.getText(tree))) {
      values[node.name.getText(tree)] = node.initializer.getText(tree)
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return [values.dateText ?? values.liveDate, values.timeText ?? values.liveTime]
})
const samples = [
  ["2026-09-23T18:29:59Z", "Wed, 23 Sept, 2026", "11:59:59 pm"],
  ["2026-09-23T18:30:00Z", "Thu, 24 Sept, 2026", "12:00:00 am"],
  ["2026-12-31T18:29:59Z", "Thu, 31 Dec, 2026", "11:59:59 pm"],
  ["2026-12-31T18:30:00Z", "Fri, 01 Jan, 2027", "12:00:00 am"],
]
const results = []
for (const TZ of ["Asia/Kolkata", "Europe/Moscow", "UTC"]) {
  const code = `const expressions=${JSON.stringify(expressions)}, samples=${JSON.stringify(samples)}; console.log(JSON.stringify(samples.map(([stamp])=>{const now=new Date(stamp);return expressions.map(pair=>pair.map(expression=>eval(expression)))})))`
  const child = spawnSync(process.execPath, ["-e", code], { env: { ...process.env, TZ }, encoding: "utf8" })
  assert.equal(child.status, 0, child.stderr)
  const result = JSON.parse(child.stdout)
  for (const [index, sample] of samples.entries()) {
    for (const widget of result[index]) assert.deepEqual(widget, sample.slice(1), `${TZ} ${sample[0]}`)
  }
  results.push(result)
}
assert.deepEqual(results[0], results[1])
assert.deepEqual(results[0], results[2])
console.log("PASS: actual home/sidebar expressions across three host timezones, IST midnight and year rollover")
