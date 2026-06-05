#!/usr/bin/env node
/**
 * test-changed.mjs — 单测增量门禁包装器（ADR-180 D-180-1 / D-180-2，CHG-TEST-SLIM-B）
 *
 * 分级逻辑：
 *   1. 取改动集：git diff --name-only <base>（工作区 ∪ staged，含删除 D——删 helpers/基础包必须升全量）∪ untracked
 *   2. docs-only（全部改动为 *.md / docs/** / .github/**）→ 打印 SKIP，exit 0
 *   3. 命中升全量触发集（配置 / tests/helpers / 基础包 / 本脚本自身）→ vitest run 全量
 *   4. 否则 → vitest run --changed <base>（vitest import 图反向选测）
 *   5. 安全网：git 不可用 / --changed 选中 0 测试但有非 docs 改动 → fallback 全量（宁多跑不漏测）
 *
 * 用法：
 *   npm run test:changed                  # 对比 HEAD（commit 前日常门禁）
 *   npm run test:changed:main             # 对比 origin/main（合并 main 前）
 *   node scripts/test-changed.mjs --base <ref> [--dry-run] [-- <vitest 额外参数>]
 *   --dry-run：只打印分级决策（SKIP / FULL / CHANGED），不运行 vitest
 *
 * 全量兜底三节点（preflight 冷启动 / PHASE COMPLETE 审计前 / 合并 main 前）见
 * docs/rules/workflow-rules.md；test:run / test:guarded 全量语义不受本脚本影响。
 */
import { execFileSync, spawnSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VITEST = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'vitest.cmd' : 'vitest')

// ── 参数解析：--base <ref>；其余参数透传给 vitest ──────────────────────────
const argv = process.argv.slice(2)
let base = 'HEAD'
let dryRun = false
const passthrough = []
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--base') {
    base = argv[++i] ?? 'HEAD'
  } else if (argv[i] === '--dry-run') {
    dryRun = true
  } else if (argv[i] !== '--') {
    passthrough.push(argv[i])
  }
}

// ── 升全量触发集（D-180-2 脚本层；与 vitest.config.ts forceRerunTriggers 双保险）──
const FORCE_FULL_PATTERNS = [
  /^vitest\.config\.ts$/,
  /^vitest\.integration\.config\.ts$/,
  /(^|\/)package\.json$/,            // 根及任意 workspace
  /(^|\/)tsconfig[^/]*\.json$/,
  /^turbo\.json$/,
  /^tests\/helpers\//,               // setup.ts 全局加载；db/factories 部分 import，统一升全量
  /^scripts\/test-changed\.mjs$/,    // 本脚本自身
  /^scripts\/test-guarded\.ts$/,
  /^packages\/(types|player-core|logger)\//, // 基础包：import 爆炸面大，直接全量更稳
]

// ── docs-only 跳过集 ───────────────────────────────────────────────────────
const DOCS_PATTERNS = [/\.md$/, /^docs\//, /^\.github\//, /\.txt$/]

function runVitest(args, reason) {
  console.log(`[test-changed] ${reason}`)
  if (dryRun) {
    console.log(`[test-changed] DRY-RUN: FULL — vitest run ${args.join(' ')}`)
    process.exit(0)
  }
  console.log(`[test-changed] vitest run ${args.join(' ')}`)
  const r = spawnSync(VITEST, ['run', ...args, ...passthrough], { cwd: ROOT, stdio: 'inherit' })
  process.exit(r.status ?? 1)
}

function getChangedFiles() {
  const opts = { cwd: ROOT, encoding: 'utf8' }
  // 不加 --diff-filter：本清单仅用于分级（docs-only / 触发集 / 增量），必须含删除（D）——
  // 删 tests/helpers/** 或基础包文件同样要升全量；删普通源文件走 --changed（vitest 选中
  // 仍 import 它的测试报错暴露，或零选中走安全网全量）。Codex review FIX：原 ACMR 漏删除。
  const diff = execFileSync('git', ['diff', '--name-only', base], opts)
  const cached = execFileSync('git', ['diff', '--name-only', '--cached'], opts)
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], opts)
  return [...new Set([diff, cached, untracked].flatMap((s) => s.split('\n').map((l) => l.trim()).filter(Boolean)))]
}

// ── 1. 改动集（git 异常 → 安全网全量）──────────────────────────────────────
let changed
try {
  changed = getChangedFiles()
} catch (err) {
  runVitest([], `git 改动检测失败（${err.message?.split('\n')[0]}）→ 安全网升全量`)
}

if (changed.length === 0) {
  console.log(`[test-changed] 对比 ${base} 无任何改动 → 无需运行单测（exit 0）`)
  console.log('[test-changed] 如需全量基线请用 npm run test:run')
  process.exit(0)
}

// ── 2. docs-only 跳过 ──────────────────────────────────────────────────────
const nonDocs = changed.filter((f) => !DOCS_PATTERNS.some((p) => p.test(f)))
if (nonDocs.length === 0) {
  console.log(`[test-changed] SKIP — ${changed.length} 个改动全部为文档类（*.md / docs/ / .github/），单测零运行（exit 0）`)
  process.exit(0)
}

// ── 3. 升全量触发集 ────────────────────────────────────────────────────────
const forceHits = nonDocs.filter((f) => FORCE_FULL_PATTERNS.some((p) => p.test(f)))
if (forceHits.length > 0) {
  runVitest([], `命中升全量触发集（${forceHits.slice(0, 5).join(', ')}${forceHits.length > 5 ? ` 等 ${forceHits.length} 项` : ''}）→ 全量`)
}

// ── 4. 增量：vitest run --changed <base>（流式输出 + 缓冲检测零选中）────────
console.log(`[test-changed] ${nonDocs.length} 个非文档改动 → vitest run --changed ${base}`)
if (dryRun) {
  console.log('[test-changed] DRY-RUN: CHANGED — 增量选测路径')
  process.exit(0)
}
const child = spawn(VITEST, ['run', '--changed', base, ...passthrough], { cwd: ROOT })
let buffer = ''
child.stdout.on('data', (d) => { buffer += d; process.stdout.write(d) })
child.stderr.on('data', (d) => { buffer += d; process.stderr.write(d) })
child.on('close', (code) => {
  if (code !== 0 && /No test files found/i.test(buffer)) {
    // ── 5. 安全网：有非 docs 改动但 import 图选中 0 测试 → 全量（D-180-1）──
    runVitest([], '非 docs 改动但 --changed 选中 0 个测试文件 → 安全网升全量（宁多跑不漏测）')
  }
  process.exit(code ?? 1)
})
