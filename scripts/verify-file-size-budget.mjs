#!/usr/bin/env node
/**
 * verify-file-size-budget.mjs — 文件大小硬上限守卫（CHG-SN-7-PRE-01）
 *
 * 起源：M-SN-6 关闭复核（CHG-SN-6-29-FOLLOWUP, 2026-05-17）发现"自评数据可信度"
 * 盲点 — PATCH-2 §质量门禁第 6 条声称"全部 ≤ 500 行"实际 7 文件超限。需要静态
 * 扫描守卫 + preflight 集成，把 CLAUDE.md §绝对禁止第 11 条「文件超 500 行非声
 * 明性 / 导出 2+ 主要概念」从"软门"提升为"硬门"。
 *
 * 扫描范围：
 *   - apps/**\/*.{ts,tsx} （排除 node_modules / dist / .next）
 *   - packages/**\/*.{ts,tsx} （同上）
 *
 * 判定规则：
 *   1. 文件行数 > 500 → 收入"超限清单"
 *   2. 超限清单按以下顺序匹配：
 *      a. 命中 BASELINE_EXEMPT（5 个历史超限文件 / M-SN-6 复核实测）→ 报"baseline warning"不阻断
 *      b. 命中 GENERIC_WHITELIST（结构性大文件 .types.ts / index.ts / migration SQL/queries 类）→ 跳过
 *      c. 其他 → FAIL（新增文件零容忍）
 *
 * 退出码：
 *   - 0：通过（可能含 baseline warning）
 *   - 1：命中新违规
 *   - 2：脚本本身错误（路径错 / IO 错）
 *
 * 使用：
 *   node scripts/verify-file-size-budget.mjs
 *   npm run verify:file-size-budget
 *
 * 维护：
 *   - BASELINE_EXEMPT 清单仅在历史文件主动拆分完成（CHG-SN-7-MISC-FILE-SIZE 等）
 *     后才移除对应条目；不得为新违规临时加项。
 *   - GENERIC_WHITELIST 仅放声明性 / 结构性文件（types / index / schema），不放
 *     业务实现文件。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, relative, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const MAX_LINES = 500

// ── 扫描根 + 排除目录 ────────────────────────────────────────────

const SCAN_ROOTS = ['apps', 'packages']
const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  'build',
  'coverage',
  '.git',
])

// ── PERMANENT 豁免（v1 frozen / CHG-SN-7-PRE-01 用户裁决 2026-05-18）──
// CLAUDE.md 明示 apps/server 是 v1 已冻结，"仅维护期 bug 修复"；拆分 v1 大文件
// 违反冻结边界。这些文件永久豁免硬上限守卫，不挂拆分卡。

const PERMANENT_EXEMPT = new Set([
  // apps/server v1 frozen — 5 文件
  'apps/server/src/components/admin/AdminVideoForm.tsx',
  'apps/server/src/components/admin/sources/InactiveSourceTable.tsx',
  'apps/server/src/components/admin/moderation/ModerationList.tsx',
  'apps/server/src/components/admin/videos/VideoImageSection.tsx',
  'apps/server/src/components/admin/staging/StagingTable.tsx',
])

// ── BASELINE 豁免（M-SN-6 关闭复核 2026-05-17 实测 + CHG-SN-7-PRE-01 全量扩范围 2026-05-18）─────
// 待拆分的历史超限文件；M-SN-7 + 后续 milestone 通过 MISC / FILE-SIZE 跟踪卡逐步拆分。
// 新增文件不得加入此清单；拆分完成后对应条目即移除。

const BASELINE_EXEMPT = new Set([
  // ── M-SN-6 复核已识别（server-next + admin-ui，7 文件）─────
  'apps/server-next/src/app/admin/merge/_client/MergeClient.tsx',
  'apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx',
  'apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx',
  'packages/admin-ui/src/shell/sidebar.tsx',
  'packages/admin-ui/src/components/data-table/data-table.tsx',
  'apps/server-next/src/app/admin/audit/_client/AuditClient.tsx',
  'apps/server-next/src/app/admin/image-health/_client/ImageHealthClient.tsx',

  // ── CHG-SN-7-PRE-01 全量扩范围发现（2026-05-18，21→16 文件，剔除 5 永久豁免）─────
  // apps/api DB queries（6 文件 / 跟踪卡 CHG-SN-7-MISC-API-QUERIES-SIZE）
  'apps/api/src/db/queries/videos.ts',                  // 1583 / 重灾区
  'apps/api/src/db/queries/sources.ts',                 // 818
  'apps/api/src/db/queries/crawlerTasks.ts',            // 628
  'apps/api/src/db/queries/mediaCatalog.ts',            // 577
  'apps/api/src/db/queries/imageHealth.ts',             // 536
  // apps/api routes（2 文件 / 跟踪卡 CHG-SN-7-MISC-API-ROUTES-SIZE）
  'apps/api/src/routes/admin/crawler.ts',               // 960
  'apps/api/src/routes/admin/moderation.ts',            // 533
  // apps/api services + workers（4 文件 / 跟踪卡 CHG-SN-7-MISC-API-SERVICES-SIZE）
  'apps/api/src/workers/crawlerWorker.ts',              // 585
  'apps/api/src/services/VideoMergesService.ts',        // 523
  'apps/api/src/services/DoubanService.ts',             // 511
  'apps/api/src/services/SourceParserService.ts',       // 502
  // apps/web-next（1 文件 / 跟踪卡 CHG-SN-7-MISC-WEB-NEXT-SIZE）
  'apps/web-next/src/components/layout/Nav.tsx',        // 580
  // packages/player + player-core（4 文件 / 跟踪卡 CHG-SN-7-MISC-PLAYER-CORE-SIZE）
  'packages/player-core/src/Player.tsx',                // 1091
  'packages/player/src/core/Player.tsx',                // 1085
  'packages/player-core/src/hooks/useLayoutDecision.ts',// 526
  'packages/player/src/core/hooks/useLayoutDecision.ts',// 526
])

// ── 结构性 / 声明性文件 whitelist ────────────────────────────────
// 用 suffix / basename 模式匹配；这些文件超 500 行属于"声明聚合"语义无害。

const GENERIC_WHITELIST_SUFFIX = [
  '.types.ts',
  '.schema.ts',
  '.constants.ts',
  '.fixtures.ts',
  '.generated.ts',
]

const GENERIC_WHITELIST_BASENAME = new Set([
  'index.ts',
  'index.tsx',
])

// migration / schema / queries 目录下纯 SQL/类型聚合也豁免（但 routes/components 不豁免）
const PATH_REGEX_WHITELIST = [
  /\/db\/migrations\//,
  /\/db\/schema\.(ts|sql)$/,
  /\/i18n\/messages\//,
  /\.d\.ts$/,
]

// ── 辅助函数 ────────────────────────────────────────────────────

function shouldExcludeDir(name) {
  return EXCLUDE_DIRS.has(name) || name.startsWith('.')
}

function isTargetFile(filename) {
  return filename.endsWith('.ts') || filename.endsWith('.tsx')
}

function isWhitelisted(relPath) {
  const base = relPath.split('/').pop() ?? ''
  if (GENERIC_WHITELIST_BASENAME.has(base)) return true
  for (const suffix of GENERIC_WHITELIST_SUFFIX) {
    if (base.endsWith(suffix)) return true
  }
  for (const re of PATH_REGEX_WHITELIST) {
    if (re.test('/' + relPath)) return true
  }
  return false
}

function walk(dir, files) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch (err) {
    if (err.code === 'ENOENT') return // 目录不存在，跳过
    throw err
  }
  for (const entry of entries) {
    if (shouldExcludeDir(entry)) continue
    const full = join(dir, entry)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue // broken symlink etc
    }
    if (stat.isDirectory()) {
      walk(full, files)
    } else if (stat.isFile() && isTargetFile(entry)) {
      files.push(full)
    }
  }
}

function countLines(filepath) {
  const content = readFileSync(filepath, 'utf8')
  // 末尾无换行也算最后一行（与 wc -l 行为一致：wc -l 数换行符，但本守卫更贴近"行计数"语义）
  if (content.length === 0) return 0
  const newlines = (content.match(/\n/g) ?? []).length
  return content.endsWith('\n') ? newlines : newlines + 1
}

// ── 主流程 ──────────────────────────────────────────────────────

function main() {
  const allFiles = []
  for (const root of SCAN_ROOTS) {
    walk(resolve(ROOT, root), allFiles)
  }

  const violations = [] // { relPath, lines }
  const baselineWarnings = []
  const permanentSkipped = []

  for (const filepath of allFiles) {
    const relPath = relative(ROOT, filepath).split(sep).join('/')
    const lines = countLines(filepath)
    if (lines <= MAX_LINES) continue

    if (isWhitelisted(relPath)) continue

    if (PERMANENT_EXEMPT.has(relPath)) {
      permanentSkipped.push({ relPath, lines })
      continue
    }

    if (BASELINE_EXEMPT.has(relPath)) {
      baselineWarnings.push({ relPath, lines })
      continue
    }

    violations.push({ relPath, lines })
  }

  // 报告
  console.log('━'.repeat(60))
  console.log('  verify:file-size-budget (CHG-SN-7-PRE-01)')
  console.log('━'.repeat(60))
  console.log(`  扫描根：${SCAN_ROOTS.join(', ')}`)
  console.log(`  硬上限：${MAX_LINES} 行（CLAUDE.md §绝对禁止第 11 条）`)
  console.log(`  扫描文件总数：${allFiles.length}`)
  console.log('')

  if (permanentSkipped.length > 0) {
    console.log(`🧊 PERMANENT 豁免（${permanentSkipped.length} 文件 / v1 frozen）：`)
    for (const { relPath, lines } of permanentSkipped.sort((a, b) => b.lines - a.lines)) {
      console.log(`    ${String(lines).padStart(5)}  ${relPath}`)
    }
    console.log('   ↑ apps/server v1 已冻结（CLAUDE.md），不拆分；不计入待办')
    console.log('')
  }

  if (baselineWarnings.length > 0) {
    console.log(`⚠️  Baseline 豁免（${baselineWarnings.length} 文件 / M-SN-6 复核 + PRE-01 全量扩范围）：`)
    for (const { relPath, lines } of baselineWarnings.sort((a, b) => b.lines - a.lines)) {
      console.log(`    ${String(lines).padStart(5)}  ${relPath}`)
    }
    console.log('   ↑ 不阻断 CI，已挂 MISC 拆分跟踪卡（FILE-SIZE / API-* / PLAYER-CORE-SIZE 等）')
    console.log('')
  }

  if (violations.length > 0) {
    console.log(`❌ 新违规（${violations.length} 文件 / 新增零容忍）：`)
    for (const { relPath, lines } of violations.sort((a, b) => b.lines - a.lines)) {
      console.log(`    ${String(lines).padStart(5)}  ${relPath}`)
    }
    console.log('')
    console.log('   修复方法：')
    console.log('   1. 拆分文件（PATCH-1 范式：主容器 + 子组件 + 列定义 + 表单 Drawer）')
    console.log('   2. 如确属声明性 / 结构性（types/index/schema）→ 加 GENERIC_WHITELIST')
    console.log('   3. 不得为新违规临时加 BASELINE_EXEMPT（违反"新增零容忍"原则）')
    process.exit(1)
  }

  console.log('✅ 通过：0 新违规')
  console.log('')
  process.exit(0)
}

try {
  main()
} catch (err) {
  console.error('💥 脚本错误：', err.message)
  console.error(err.stack)
  process.exit(2)
}
