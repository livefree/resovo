#!/usr/bin/env tsx
/**
 * verify-baseline.ts
 * Validates docs/baseline_20260418/failing_tests.json schema and
 * optionally checks counts against phase-notice numbers.
 *
 * Usage:
 *   npm run verify:baseline                          # schema check + print counts
 *   npm run verify:baseline -- --unit 16 --e2e 9    # also assert exact counts
 *   npm run verify:baseline -- --total 25            # assert total
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASELINE_PATH = path.join(__dirname, '..', 'docs', 'baseline_20260418', 'failing_tests.json')

interface FailingTest {
  test_id: string
  suite: string
  kind: 'unit' | 'e2e'
  status: 'failed' | 'passed' | 'flaky'
  duration_ms: number
  error_excerpt: string
}

const REQUIRED_FIELDS = ['test_id', 'suite', 'kind', 'status', 'duration_ms', 'error_excerpt'] as const
const VALID_KINDS = new Set(['unit', 'e2e'])
const VALID_STATUSES = new Set(['failed', 'passed', 'flaky'])

function validateSchema(tests: FailingTest[]): string[] {
  const errors: string[] = []
  tests.forEach((t, i) => {
    for (const field of REQUIRED_FIELDS) {
      const val = t[field]
      if (val === undefined || val === null || val === '') {
        errors.push(`[${i}] missing or empty field: "${field}" (test_id: ${t.test_id ?? '?'})`)
      }
    }
    if (!VALID_KINDS.has(t.kind)) {
      errors.push(`[${i}] invalid kind: "${t.kind}" — must be "unit" or "e2e"`)
    }
    if (!VALID_STATUSES.has(t.status)) {
      errors.push(`[${i}] invalid status: "${t.status}" — must be "failed", "passed", or "flaky"`)
    }
    if (typeof t.duration_ms !== 'number' || isNaN(t.duration_ms)) {
      errors.push(`[${i}] duration_ms must be a finite number`)
    }
  })
  const ids = tests.map((t) => t.test_id)
  const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx)
  if (dupes.length > 0) {
    errors.push(`duplicate test_ids: ${[...new Set(dupes)].join(', ')}`)
  }
  return errors
}

function parseArgs(): Record<string, number> {
  const args = process.argv.slice(2)
  const result: Record<string, number> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      const key = args[i].slice(2)
      const val = parseInt(args[i + 1], 10)
      if (!isNaN(val)) {
        result[key] = val
        i++
      }
    }
  }
  return result
}

function main(): void {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`ERROR: baseline file not found: ${BASELINE_PATH}`)
    process.exit(1)
  }

  let tests: FailingTest[]
  try {
    tests = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as FailingTest[]
  } catch (e) {
    console.error(`ERROR: JSON parse failed: ${(e as Error).message}`)
    process.exit(1)
  }

  if (!Array.isArray(tests)) {
    console.error('ERROR: failing_tests.json root must be a JSON array')
    process.exit(1)
  }

  const schemaErrors = validateSchema(tests)
  if (schemaErrors.length > 0) {
    console.error('SCHEMA ERRORS in failing_tests.json:')
    schemaErrors.forEach((e) => console.error(`  ${e}`))
    process.exit(1)
  }

  const unitFailed = tests.filter((t) => t.kind === 'unit' && t.status === 'failed').length
  const e2eFailed = tests.filter((t) => t.kind === 'e2e' && t.status === 'failed').length
  const totalFailed = tests.filter((t) => t.status === 'failed').length

  console.log('Baseline counts (failing_tests.json):')
  console.log(`  unit  failed : ${unitFailed}`)
  console.log(`  e2e   failed : ${e2eFailed}`)
  console.log(`  total failed : ${totalFailed}`)
  console.log(`  total entries: ${tests.length}`)

  const expected = parseArgs()
  let mismatch = false

  if ('unit' in expected && expected.unit !== unitFailed) {
    console.error(`MISMATCH: --unit expected ${expected.unit}, got ${unitFailed}`)
    mismatch = true
  }
  if ('e2e' in expected && expected.e2e !== e2eFailed) {
    console.error(`MISMATCH: --e2e expected ${expected.e2e}, got ${e2eFailed}`)
    mismatch = true
  }
  if ('total' in expected && expected.total !== totalFailed) {
    console.error(`MISMATCH: --total expected ${expected.total}, got ${totalFailed}`)
    mismatch = true
  }

  if (mismatch) {
    console.error('FAIL: phase-notice numbers do not match baseline — PHASE COMPLETE blocked')
    process.exit(1)
  }

  console.log('OK: schema valid' + (Object.keys(expected).length > 0 ? ', counts match' : ''))
}

main()
