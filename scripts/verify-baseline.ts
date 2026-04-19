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
 *   npm run verify:baseline -- --diff                # diff baseline vs quarantine list
 *   npm run verify:baseline -- --coverage-report     # per-suite breakdown vs e2e_coverage_report.md
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

interface CoverageStat {
  total: number
  pass: number
  fail: number
  flaky: number
}

const VALID_PHASE_TARGETS = new Set([
  'M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6',
  'PHASE COMPLETE',
])
const TESTFIX_PATTERN = /^TESTFIX-\d+$/

function isValidPhaseTarget(target: string): boolean {
  return VALID_PHASE_TARGETS.has(target) || TESTFIX_PATTERN.test(target)
}

function parseArgs(): { counts: Record<string, number>; diff: boolean; phase: number; coverageReport: boolean; phaseTarget: string | null } {
  const args = process.argv.slice(2)
  const counts: Record<string, number> = {}
  let diff = false
  let phase = 0
  let coverageReport = false
  let phaseTarget: string | null = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--diff') {
      diff = true
    } else if (args[i] === '--coverage-report') {
      coverageReport = true
    } else if (args[i] === '--phase' && i + 1 < args.length) {
      phase = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--phase-target' && i + 1 < args.length) {
      phaseTarget = args[i + 1]
      i++
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      const key = args[i].slice(2)
      const val = parseInt(args[i + 1], 10)
      if (!isNaN(val)) {
        counts[key] = val
        i++
      }
    }
  }
  return { counts, diff, phase, coverageReport, phaseTarget }
}

function readCoverageReport(): Record<string, CoverageStat> | null {
  const reportPath = path.join(__dirname, '..', 'docs', 'baseline_20260418', 'e2e_coverage_report.md')
  if (!fs.existsSync(reportPath)) {
    return null
  }
  const content = fs.readFileSync(reportPath, 'utf-8')
  const match = content.match(/```json\n([\s\S]+?)```/)
  if (!match) return null
  try {
    return JSON.parse(match[1]) as Record<string, CoverageStat>
  } catch {
    return null
  }
}

function runCoverageReport(tests: FailingTest[]): boolean {
  const expected = readCoverageReport()
  if (!expected) {
    console.error('ERROR: e2e_coverage_report.md not found or JSON block missing')
    return false
  }

  const baselineFailsBySuite: Record<string, number> = {}
  for (const t of tests) {
    if (t.kind === 'e2e' && t.status === 'failed') {
      const suiteName = path.basename(t.suite)
      baselineFailsBySuite[suiteName] = (baselineFailsBySuite[suiteName] ?? 0) + 1
    }
  }

  // ── Legacy E2E project (e2e/) ────────────────────────────────────────
  console.log('\nCoverage report — E2E Project: web-chromium / web-mobile / admin-chromium (tests/e2e/)')
  console.log(
    `${'Suite'.padEnd(50)} ${'Expected fail'.padStart(13)} ${'Baseline fail'.padStart(13)} ${'Match'.padStart(6)}`,
  )
  console.log('-'.repeat(85))

  let allMatch = true
  for (const [suite, stat] of Object.entries(expected)) {
    const baselineCount = baselineFailsBySuite[suite] ?? 0
    const match = baselineCount === stat.fail
    if (!match) allMatch = false
    const marker = match ? 'OK' : 'MISMATCH'
    console.log(
      `${suite.padEnd(50)} ${String(stat.fail).padStart(13)} ${String(baselineCount).padStart(13)} ${marker.padStart(6)}`,
    )
  }

  const extraSuites = Object.keys(baselineFailsBySuite).filter((s) => !(s in expected))
  if (extraSuites.length > 0) {
    console.log(`\n  Suites in baseline but not in coverage report:`)
    extraSuites.forEach((s) => console.log(`    - ${s} (${baselineFailsBySuite[s]} failures)`))
    allMatch = false
  }

  // ── New E2E project (e2e-next/) ─────────────────────────────────────
  console.log('\nCoverage report — E2E Project: web-next-chromium (tests/e2e-next/)')
  console.log('  smoke.spec.ts  [RW-SETUP-02 scaffold verification]')
  console.log('  (additional suites added per milestone M2–M6)')

  if (!allMatch) {
    console.error('\nFAIL: coverage report numbers do not match baseline')
  } else {
    console.log('\nOK: all suite fail counts match coverage report')
  }
  return allMatch
}

function readQuarantineIds(phase: number): Set<string> {
  const quarantinePath = path.join(__dirname, '..', 'docs', `known_failing_tests_phase${phase}.md`)
  if (!fs.existsSync(quarantinePath)) {
    return new Set()
  }
  const content = fs.readFileSync(quarantinePath, 'utf-8')
  const match = content.match(/```json\n([\s\S]+?)```/)
  if (!match) return new Set()
  try {
    return new Set(JSON.parse(match[1]) as string[])
  } catch {
    return new Set()
  }
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

  const { counts: expected, diff, phase, coverageReport, phaseTarget } = parseArgs()

  if (phaseTarget !== null) {
    if (!isValidPhaseTarget(phaseTarget)) {
      console.error(`ERROR: --phase-target "${phaseTarget}" is not a valid milestone`)
      console.error(`  Valid values: M0–M6, TESTFIX-XX, "PHASE COMPLETE"`)
      process.exit(1)
    }
    console.log(`phase-target: ${phaseTarget} — OK`)
  }
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

  if (coverageReport) {
    const ok = runCoverageReport(tests)
    if (!ok) process.exit(1)
  }

  if (diff) {
    const quarantineIds = readQuarantineIds(phase)
    const baselineIds = new Set(tests.filter((t) => t.status === 'failed').map((t) => t.test_id))
    const notInQuarantine = [...baselineIds].filter((id) => !quarantineIds.has(id))
    const notInBaseline = [...quarantineIds].filter((id) => !baselineIds.has(id))
    console.log(`\nDiff: baseline vs Phase ${phase} quarantine:`)
    console.log(`  baseline failed : ${baselineIds.size}`)
    console.log(`  quarantine size : ${quarantineIds.size}`)
    if (notInQuarantine.length > 0) {
      console.log(`\n  In baseline but NOT in quarantine (${notInQuarantine.length}):`)
      notInQuarantine.forEach((id) => console.log(`    - ${id}`))
    } else {
      console.log('  All baseline failures are covered by quarantine.')
    }
    if (notInBaseline.length > 0) {
      console.log(`\n  In quarantine but NOT in baseline (${notInBaseline.length}):`)
      notInBaseline.forEach((id) => console.log(`    + ${id}`))
    }
  }

  console.log('OK: schema valid' + (Object.keys(expected).length > 0 ? ', counts match' : ''))
}

main()
