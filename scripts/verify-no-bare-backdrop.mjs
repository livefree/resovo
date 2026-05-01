#!/usr/bin/env node
/**
 * verify-no-bare-backdrop.mjs — 防止在消费方裸写 dim backdrop（SEQ-20260501-01 CHG-DESIGN-17）
 *
 * 扫描范围：apps/server-next/src + packages/admin-ui/src
 * 豁免文件：
 *   packages/admin-ui/src/components/overlay/overlay-backdrop.tsx （唯一允许有 dim 逻辑的实现文件）
 *   packages/admin-ui/src/components/overlay/overlay-backdrop.test.tsx（断言 dim 行为时会出现 var(--bg-overlay) 字符串）
 *
 * 命中任一规则 → 非零退出（CI 失败）：
 *   1. background: 'var(--bg-overlay)' / background: "var(--bg-overlay)"（inline style dim 遮罩）
 *   2. background: `var(--bg-overlay)`（模板字面量变体）
 *   3. bg-black/40、bg-black/50（Tailwind 遮罩类）
 */

import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')

const SCAN_DIRS = [
  'apps/server-next/src',
  'packages/admin-ui/src',
]

const EXEMPT_FILES = new Set([
  'packages/admin-ui/src/components/overlay/overlay-backdrop.tsx',
  'packages/admin-ui/src/components/overlay/overlay-backdrop.test.tsx',
])

/** ripgrep パターン（-F = fixed string，-e = pattern） */
const PATTERNS = [
  // background: 'var(--bg-overlay)' or "var(--bg-overlay)" or `var(--bg-overlay)`
  `background.*var\\(--bg-overlay\\)`,
  // Tailwind 全屏遮罩类
  `bg-black/40`,
  `bg-black/50`,
]

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', cwd: ROOT }).trim()
  } catch (err) {
    if (err.status === 1 && err.stdout === '') return ''
    throw err
  }
}

function checkScanDirsExist() {
  for (const dir of SCAN_DIRS) {
    if (!existsSync(resolve(ROOT, dir))) {
      console.warn(`[verify-no-bare-backdrop] warn: scan dir not found, skipping: ${dir}`)
    }
  }
}

function buildRgArgs() {
  const dirs = SCAN_DIRS.filter((d) => existsSync(resolve(ROOT, d))).join(' ')
  if (!dirs) return null
  const patternArgs = PATTERNS.map((p) => `-e "${p}"`).join(' ')
  return `rg --no-heading -n --glob "*.{ts,tsx}" ${patternArgs} ${dirs}`
}

function filterExempt(output) {
  if (!output) return []
  return output
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .filter((line) => {
      // line format: "path/to/file.tsx:42:  background: 'var(--bg-overlay)'"
      const filePath = line.split(':')[0] ?? ''
      for (const exempt of EXEMPT_FILES) {
        if (filePath.endsWith(exempt) || filePath === exempt) return false
      }
      return true
    })
}

checkScanDirsExist()

const rgCmd = buildRgArgs()
if (!rgCmd) {
  console.log('[verify-no-bare-backdrop] no scan dirs found, skipping.')
  process.exit(0)
}

const raw = sh(rgCmd)
const violations = filterExempt(raw)

if (violations.length === 0) {
  console.log('[verify-no-bare-backdrop] ✓ 零命中，无裸写 dim backdrop。')
  process.exit(0)
} else {
  console.error('[verify-no-bare-backdrop] ✗ 发现裸写 dim backdrop，请改用 <OverlayBackdrop backdropTone="dim">（需设计确认）：\n')
  for (const line of violations) {
    console.error(`  ${line}`)
  }
  console.error('\n豁免文件仅限：')
  for (const f of EXEMPT_FILES) {
    console.error(`  ${f}`)
  }
  process.exit(1)
}
