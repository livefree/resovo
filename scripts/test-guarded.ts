#!/usr/bin/env tsx
/**
 * test-guarded.ts
 * CI gate: run unit tests and compare failures against Phase quarantine list.
 *
 * Usage:
 *   npm run test:guarded                  # unit tests, Phase 0 quarantine
 *   npm run test:guarded -- --phase 1     # use Phase 1 quarantine list
 *   npm run test:guarded -- --e2e-info    # also print E2E quarantine summary
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

function parseArgs(): { phase: number; e2eInfo: boolean } {
  const args = process.argv.slice(2)
  let phase = 0
  let e2eInfo = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--phase' && i + 1 < args.length) {
      phase = parseInt(args[i + 1], 10)
      i++
    }
    if (args[i] === '--e2e-info') {
      e2eInfo = true
    }
  }
  return { phase, e2eInfo }
}

function readQuarantine(phase: number): { unit: Set<string>; e2e: Set<string> } {
  const quarantinePath = path.join(ROOT, 'docs', `known_failing_tests_phase${phase}.md`)
  if (!fs.existsSync(quarantinePath)) {
    console.warn(`WARN: quarantine file not found: ${quarantinePath}`)
    return { unit: new Set(), e2e: new Set() }
  }
  const content = fs.readFileSync(quarantinePath, 'utf-8')
  const match = content.match(/```json\n([\s\S]+?)```/)
  if (!match) {
    console.warn('WARN: no JSON quarantine block found in quarantine file')
    return { unit: new Set(), e2e: new Set() }
  }
  let ids: string[]
  try {
    ids = JSON.parse(match[1]) as string[]
  } catch (e) {
    console.error(`ERROR: could not parse quarantine JSON: ${(e as Error).message}`)
    process.exit(1)
  }
  const unit = new Set(ids.filter((id) => id.startsWith('unit::')))
  const e2e = new Set(ids.filter((id) => id.startsWith('e2e::')))
  return { unit, e2e }
}

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

function getFailingTestIds(results: VitestOutput): string[] {
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

function main(): void {
  const { phase, e2eInfo } = parseArgs()

  console.log(`Phase ${phase} quarantine gate — running unit tests...`)
  const results = runUnitTests()
  const failing = getFailingTestIds(results)
  const { unit: unitQuarantine, e2e: e2eQuarantine } = readQuarantine(phase)

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

  if (e2eInfo) {
    console.log(`\nINFO: E2E quarantine (${e2eQuarantine.size} items, not run here):`)
    ;[...e2eQuarantine].forEach((id) => console.log(`  ○ ${id}`))
  }

  if (newFailures.length > 0) {
    console.error('\nFAIL: New failures outside quarantine:')
    newFailures.forEach((id) => console.error(`  ✗ NEW: ${id}`))
    console.error(`\nGATE BLOCKED: ${newFailures.length} new failure(s) — fix before merging`)
    process.exit(1)
  }

  console.log('\nGATE PASSED: all unit test failures within quarantine')
}

main()
