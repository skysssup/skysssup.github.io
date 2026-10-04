// CLI: node verify-scheduler.mjs [path/to/scheduler-cases.json]
// Exits 0 only when every case produced by the Python scheduler is reproduced exactly by scheduler.mjs.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { verify } from './parity.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const path = process.argv[2] ?? join(here, 'scheduler-cases.json')
const doc = JSON.parse(readFileSync(path, 'utf8'))
const { sections, failures, rawPriorityEqual, priorityTotal } = verify(doc)

console.log(`Recall scheduler parity: scheduler.mjs vs ${doc.source} @ ${doc.commit} (Python ${doc.python}, Node ${process.versions.node})`)
let total = 0
for (const s of sections) {
  total += s.checks
  console.log(`  ${s.name.padEnd(22)} ${s.detail.padEnd(44)} ${String(s.checks).padStart(5)} checks  ${s.mismatches} mismatches`)
}
console.log(`  raw priority floats bit-identical: ${rawPriorityEqual}/${priorityTotal} (the API serves them rounded to 4 decimals)`)
for (const line of failures.slice(0, 20)) console.log(`  MISMATCH ${line}`)
console.log(failures.length ? `FAILED: ${failures.length} of ${total} checks differ` : `OK: all ${total} checks identical`)
process.exit(failures.length ? 1 : 0)
