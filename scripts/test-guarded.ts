#!/usr/bin/env tsx
/**
 * test-guarded.ts
 * CI gate: run tests and compare failures against Phase quarantine list.
 *
 * Usage:
 *   npm run test:guarded                      # unit tests only (default, Phase 0)
 *   npm run test:guarded -- --phase 1         # use Phase 1 quarantine
 *   npm run test:guarded -- --e2e-info        # also print E2E quarantine summary
 *   npm run test:guarded:e2e                  # E2E tests only
 *   npm run test:guarded:all                  # unit + E2E
 *   npm run test:guarded -- --mode e2e        # same as test:guarded:e2e
 *   npm run test:guarded -- --mode all        # same as test:guarded:all
 *
 * Exit codes:
 *   0 = all failures are within quarantine (or no failures)
 *   1 = new failure detected outside quarantine
 */

import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const RESULTS_FILE = path.join(os.tmpdir(), `vitest-guarded-${Date.now()}.json`)
const E2E_RESULTS_FILE = path.join(os.tmpdir(), `playwright-guarded-${Date.now()}.json`)

type RunMode = 'unit' | 'e2e' | 'all'

function parseArgs(): { phase: number; e2eInfo: boolean; mode: RunMode } {
  const args = process.argv.slice(2)
  let phase = 0
  let e2eInfo = false
  let mode: RunMode = 'unit'
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--phase' && i + 1 < args.length) {
      phase = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--e2e-info') {
      e2eInfo = true
    } else if (args[i] === '--mode' && i + 1 < args.length) {
      const val = args[i + 1]
      if (val === 'unit' || val === 'e2e' || val === 'all') {
        mode = val
      } else {
        console.error(`ERROR: --mode must be one of: unit, e2e, all (got: "${val}")`)
        process.exit(1)
      }
      i++
    }
  }
  return { phase, e2eInfo, mode }
}

function readQuarantine(phase: number): { unit: Set<string>; e2e: Set<string>; e2eNext: Set<string> } {
  const quarantinePath = path.join(ROOT, 'docs', `known_failing_tests_phase${phase}.md`)
  if (!fs.existsSync(quarantinePath)) {
    console.warn(`WARN: quarantine file not found: ${quarantinePath}`)
    return { unit: new Set(), e2e: new Set(), e2eNext: new Set() }
  }
  const content = fs.readFileSync(quarantinePath, 'utf-8')
  const match = content.match(/```json\n([\s\S]+?)```/)
  if (!match) {
    console.warn('WARN: no JSON quarantine block found in quarantine file')
    return { unit: new Set(), e2e: new Set(), e2eNext: new Set() }
  }
  let ids: string[]
  try {
    ids = JSON.parse(match[1]) as string[]
  } catch (e) {
    console.error(`ERROR: could not parse quarantine JSON: ${(e as Error).message}`)
    process.exit(1)
  }
  const unit = new Set(ids.filter((id) => id.startsWith('unit::')))
  const e2e = new Set(ids.filter((id) => id.startsWith('e2e::') && !id.startsWith('e2e-next::')))
  const e2eNext = new Set(ids.filter((id) => id.startsWith('e2e-next::')))
  return { unit, e2e, e2eNext }
}

// ── Unit test types ──────────────────────────────────────────────────

interface VitestTestResult {
  name: string
  assertionResults: Array<{
    ancestorTitles: string[]
    title: string
    status: 'passed' | 'failed' | 'pending' | 'todo'
    failureMessages: string[]
  }>
}

interface VitestOutput {
  success: boolean
  numTotalTests: number
  numPassedTests: number
  numFailedTests: number
  testResults: VitestTestResult[]
}

function runUnitTests(): VitestOutput {
  const result = spawnSync(
    'npm',
    ['run', 'test', '--', '--run', '--reporter=json', `--outputFile=${RESULTS_FILE}`],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], shell: true },
  )

  if (!fs.existsSync(RESULTS_FILE)) {
    console.error('ERROR: vitest did not produce results file')
    console.error('Exit code:', result.status)
    process.exit(1)
  }

  const output = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8')) as VitestOutput
  fs.unlinkSync(RESULTS_FILE)
  return output
}

function getUnitFailingIds(results: VitestOutput): string[] {
  const failing: string[] = []
  for (const file of results.testResults) {
    const fileBase = path.basename(file.name).replace(/\.(test|spec)\.(ts|tsx|js)$/, '')
    for (const test of file.assertionResults) {
      if (test.status === 'failed') {
        const suite = test.ancestorTitles.join(' > ')
        const testId = `unit::${fileBase}::${suite}::${test.title}`
        failing.push(testId)
      }
    }
  }
  return failing
}

// ── E2E test types ───────────────────────────────────────────────────

interface PlaywrightSpec {
  title: string
  ok: boolean
  tests: Array<{
    status: 'expected' | 'unexpected' | 'flaky' | 'skipped'
    projectName?: string
  }>
}

interface PlaywrightSuite {
  title: string
  file?: string
  suites?: PlaywrightSuite[]
  specs?: PlaywrightSpec[]
}

interface PlaywrightReport {
  suites?: PlaywrightSuite[]
  stats?: {
    expected: number
    unexpected: number
    flaky: number
    skipped: number
    total?: number
  }
}

function getE2EPrefix(filePath: string): 'e2e-next' | 'e2e' {
  return filePath.includes('e2e-next') ? 'e2e-next' : 'e2e'
}

function collectE2EFailures(suites: PlaywrightSuite[], fileBase: string): string[] {
  const failing: string[] = []
  for (const suite of suites) {
    const rawFile = suite.file ?? ''
    const currentFile = rawFile
      ? path.basename(rawFile).replace(/\.(test|spec)\.(ts|tsx|js)$/, '')
      : fileBase
    const prefix = rawFile ? getE2EPrefix(rawFile) : getE2EPrefix(fileBase)
    if (suite.suites) {
      failing.push(...collectE2EFailures(suite.suites, suite.file ? rawFile : fileBase))
    }
    if (suite.specs) {
      for (const spec of suite.specs) {
        const isUnexpected = spec.tests.some(
          (t) => t.status === 'unexpected' || t.status === 'flaky',
        )
        if (!spec.ok || isUnexpected) {
          failing.push(`${prefix}::${currentFile}::${spec.title}`)
        }
      }
    }
  }
  return failing
}

interface E2ESummary {
  total: number
  passed: number
  failed: number
  flaky: number
  failingIds: string[]
}

function runE2ETests(): E2ESummary {
  const result = spawnSync(
    'npx',
    ['playwright', 'test', '--reporter=json'],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'inherit'],
      shell: true,
      timeout: 300000,
    },
  )

  const stdout = result.stdout?.toString() ?? ''
  if (!stdout.trim()) {
    console.error('ERROR: playwright did not produce JSON output (stdout empty)')
    console.error('Exit code:', result.status)
    process.exit(1)
  }

  let report: PlaywrightReport
  try {
    report = JSON.parse(stdout) as PlaywrightReport
  } catch (e) {
    console.error(`ERROR: could not parse playwright JSON output: ${(e as Error).message}`)
    process.exit(1)
  }

  const stats = report.stats ?? { expected: 0, unexpected: 0, flaky: 0, skipped: 0 }
  const total = (stats.expected ?? 0) + (stats.unexpected ?? 0) + (stats.flaky ?? 0) + (stats.skipped ?? 0)
  const failingIds = collectE2EFailures(report.suites ?? [], '')

  return {
    total,
    passed: stats.expected ?? 0,
    failed: stats.unexpected ?? 0,
    flaky: stats.flaky ?? 0,
    failingIds,
  }
}

// ── Gate runners ─────────────────────────────────────────────────────

function runUnitGate(unitQuarantine: Set<string>): boolean {
  console.log('Running unit tests...')
  const results = runUnitTests()
  const failing = getUnitFailingIds(results)

  const newFailures = failing.filter((id) => !unitQuarantine.has(id))
  const knownFailures = failing.filter((id) => unitQuarantine.has(id))
  const regressedFromQuarantine = [...unitQuarantine].filter((id) => !failing.includes(id))

  console.log('\nUnit test summary:')
  console.log(`  total        : ${results.numTotalTests}`)
  console.log(`  passed       : ${results.numPassedTests}`)
  console.log(`  failed       : ${results.numFailedTests}`)
  console.log(`  new failures : ${newFailures.length}`)
  console.log(`  quarantined  : ${knownFailures.length}`)

  if (regressedFromQuarantine.length > 0) {
    console.log('\nINFO: Quarantine items now PASSING (consider removing from list):')
    regressedFromQuarantine.forEach((id) => console.log(`  ✓ RECOVERED: ${id}`))
  }

  if (knownFailures.length > 0) {
    console.log('\nWARN: Known quarantine failures (not blocking):')
    knownFailures.forEach((id) => console.log(`  ⚠  KNOWN: ${id}`))
  }

  if (newFailures.length > 0) {
    console.error('\nFAIL: New unit failures outside quarantine:')
    newFailures.forEach((id) => console.error(`  ✗ NEW: ${id}`))
    console.error(`\nUNIT GATE BLOCKED: ${newFailures.length} new failure(s)`)
    return false
  }

  console.log('\nUNIT GATE PASSED: all unit test failures within quarantine')
  return true
}

function runE2EGate(e2eQuarantine: Set<string>, e2eNextQuarantine: Set<string>): boolean {
  console.log('Running E2E tests (playwright — web-chromium + web-mobile + admin-chromium + web-next-chromium)...')
  const summary = runE2ETests()

  // 合并两个 quarantine 集合用于统一判断
  const allQuarantine = new Set([...e2eQuarantine, ...e2eNextQuarantine])
  const newFailures = summary.failingIds.filter((id) => !allQuarantine.has(id))
  const knownFailures = summary.failingIds.filter((id) => allQuarantine.has(id))
  const regressedFromQuarantine = [...allQuarantine].filter((id) => !summary.failingIds.includes(id))

  // 分桶显示
  const legacyFailing = summary.failingIds.filter((id) => id.startsWith('e2e::'))
  const nextFailing = summary.failingIds.filter((id) => id.startsWith('e2e-next::'))

  console.log('\nE2E test summary:')
  console.log(`  total              : ${summary.total}`)
  console.log(`  passed             : ${summary.passed}`)
  console.log(`  failed             : ${summary.failed}`)
  console.log(`  flaky              : ${summary.flaky}`)
  console.log(`  new failures       : ${newFailures.length}`)
  console.log(`  quarantined        : ${knownFailures.length}`)
  console.log(`\nProject breakdown:`)
  console.log(`  e2e:: (web/admin)  : ${legacyFailing.length} failing`)
  console.log(`  e2e-next:: (web-next): ${nextFailing.length} failing`)

  if (regressedFromQuarantine.length > 0) {
    console.log('\nINFO: E2E quarantine items now PASSING (consider removing from list):')
    regressedFromQuarantine.forEach((id) => console.log(`  ✓ RECOVERED: ${id}`))
  }

  if (knownFailures.length > 0) {
    console.log('\nWARN: Known E2E quarantine failures (not blocking):')
    knownFailures.forEach((id) => console.log(`  ⚠  KNOWN: ${id}`))
  }

  if (newFailures.length > 0) {
    console.error('\nFAIL: New E2E failures outside quarantine:')
    newFailures.forEach((id) => console.error(`  ✗ NEW: ${id}`))
    console.error(`\nE2E GATE BLOCKED: ${newFailures.length} new failure(s)`)
    return false
  }

  console.log('\nE2E GATE PASSED: all E2E test failures within quarantine')
  return true
}

// ── Main ─────────────────────────────────────────────────────────────

function main(): void {
  const { phase, e2eInfo, mode } = parseArgs()

  console.log(`Phase ${phase} quarantine gate — mode: ${mode}`)
  const { unit: unitQuarantine, e2e: e2eQuarantine, e2eNext: e2eNextQuarantine } = readQuarantine(phase)

  if (mode === 'unit' && e2eInfo) {
    console.log(`\nINFO: E2E quarantine (${e2eQuarantine.size} legacy + ${e2eNextQuarantine.size} e2e-next items, not run here):`)
    ;[...e2eQuarantine, ...e2eNextQuarantine].forEach((id) => console.log(`  ○ ${id}`))
  }

  let passed = true

  if (mode === 'unit' || mode === 'all') {
    const ok = runUnitGate(unitQuarantine)
    if (!ok) passed = false
  }

  if (mode === 'e2e' || mode === 'all') {
    const ok = runE2EGate(e2eQuarantine, e2eNextQuarantine)
    if (!ok) passed = false
  }

  if (!passed) {
    console.error('\nGATE BLOCKED: fix failures before merging')
    process.exit(1)
  }

  console.log('\nGATE PASSED')
}

main()
