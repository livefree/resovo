#!/usr/bin/env node
/**
 * verify-manual-coverage.mjs — 后台说明书覆盖守卫（CHG-SN-7-CLEANUP-01-C）
 *
 * 起源：2026-05-21 SEQ-20260521-01 docs 大清理 + manual 工程地基。
 * 用户复核 server-next 实际可用性发现 13 个 UX 缺口（mock 视图 / 死按钮 / 断链
 * / UUID 输入 等）。开发模式调整为「实现 + 说明书双轨」：每个 admin 路由对应
 * 一份 manual page。本守卫脚本静态扫描 admin 路由清单 vs manual page 清单，
 * 保证 1:1 严格对齐。
 *
 * 扫描范围：
 *   - apps/server-next/src/app/admin/<slug>/page.tsx
 *   - apps/server-next/src/app/login/page.tsx
 *
 * 判定规则：
 *   1. 每个 admin 路由（除 KNOWN_NO_MANUAL）必须有对应
 *      docs/manual/20-pages/P-<slug>.md
 *   2. /login 必须有 P-login.md
 *   3. /admin/submissions 是 deprecation banner 视图 → 必须有
 *      P-submissions-deprecated.md
 *   4. 多余的 manual page（无对应路由）→ WARN 不 FAIL（允许新增 future page）
 *
 * 退出码：
 *   - 0：通过（manual 1:1 对齐 admin 路由）
 *   - 1：缺失 manual page（FAIL）
 *   - 2：脚本本身错误
 *
 * 使用：
 *   node scripts/verify-manual-coverage.mjs
 *   npm run verify:manual-coverage
 *
 * 维护：
 *   - 新增 admin 路由时同步在 docs/manual/20-pages/ 起 P-<slug>.md 草稿
 *     （建议从 docs/manual/_template/PAGE_TEMPLATE.md 复制）
 *   - 不该有 manual 的路由（如 dev 调试页）加入 KNOWN_NO_MANUAL 清单
 *     并在 docs/manual/20-pages/README.md 「不需要 manual 的路由」段注明
 */

import { readdirSync, statSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const ADMIN_DIR = resolve(ROOT, 'apps/server-next/src/app/admin')
const LOGIN_PAGE = resolve(ROOT, 'apps/server-next/src/app/login/page.tsx')
const MANUAL_DIR = resolve(ROOT, 'docs/manual/20-pages')

// ── 不需要 manual 的路由（同步更新 20-pages/README.md）─────────────
const KNOWN_NO_MANUAL = new Set([
  'dev',              // 开发者模式，不暴露给运营
  'system',           // landing 占位（settings 已是真源）
  'analytics',        // hidden + redirect 到 dashboard tab
  'staging',          // 合并到 moderation tab
])

// ── 特殊映射：/admin/<slug> → manual 文件名（不走默认 P-<slug>）────
const SPECIAL_MAP = {
  // /admin/submissions 是 deprecation banner（指向 user-submissions）
  // 仍保留 manual 以解释 deprecation 流转
  submissions: 'P-submissions-deprecated.md',
}

function scanAdminRoutes() {
  if (!existsSync(ADMIN_DIR)) {
    console.error(`✗ admin 目录不存在：${ADMIN_DIR}`)
    process.exit(2)
  }
  const entries = readdirSync(ADMIN_DIR)
  const routes = []
  for (const name of entries) {
    const full = resolve(ADMIN_DIR, name)
    if (!statSync(full).isDirectory()) continue
    if (KNOWN_NO_MANUAL.has(name)) continue
    if (!existsSync(resolve(full, 'page.tsx'))) continue
    routes.push(name)
  }
  return routes.sort()
}

function getExpectedManualName(slug) {
  if (slug in SPECIAL_MAP) return SPECIAL_MAP[slug]
  return `P-${slug}.md`
}

function scanManualFiles() {
  if (!existsSync(MANUAL_DIR)) {
    console.error(`✗ manual 目录不存在：${MANUAL_DIR}`)
    process.exit(2)
  }
  return readdirSync(MANUAL_DIR)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort()
}

// ── 主流程 ─────────────────────────────────────────────────────

const adminRoutes = scanAdminRoutes()
const manualFiles = scanManualFiles()

const expected = []
expected.push({ source: '/admin (dashboard)', file: 'P-dashboard.md' })
for (const slug of adminRoutes) {
  expected.push({ source: `/admin/${slug}`, file: getExpectedManualName(slug) })
}
// /login 顶层
if (existsSync(LOGIN_PAGE)) {
  expected.push({ source: '/login', file: 'P-login.md' })
}

const expectedFileSet = new Set(expected.map(e => e.file))
const manualSet = new Set(manualFiles)

// 缺失：expected 中有但 manual 没有
const missing = expected.filter(e => !manualSet.has(e.file))

// 多余：manual 中有但 expected 没有（WARN 级别）
const extra = manualFiles.filter(f => !expectedFileSet.has(f))

console.log('manual-coverage 守卫（CHG-SN-7-CLEANUP-01-C）')
console.log('')
console.log(`Admin 路由（需 manual）：${expected.length}`)
console.log(`docs/manual/20-pages/*.md：${manualFiles.length}`)
console.log(`KNOWN_NO_MANUAL 豁免：${[...KNOWN_NO_MANUAL].join(' / ')}`)
console.log('')

if (missing.length > 0) {
  console.error('❌ 缺失 manual（FAIL）：')
  for (const m of missing) {
    console.error(`   ${m.source} → 缺 docs/manual/20-pages/${m.file}`)
  }
  console.error('')
  console.error('修复路径：从 docs/manual/_template/PAGE_TEMPLATE.md 复制起手，')
  console.error('或参考已有 P-*.md 骨架。')
  process.exit(1)
}

if (extra.length > 0) {
  console.warn('⚠️  多余 manual（WARN，允许未来扩展但需注释）：')
  for (const f of extra) {
    console.warn(`   docs/manual/20-pages/${f} （无对应 admin 路由）`)
  }
  console.warn('')
}

console.log('✅ manual-coverage PASS：所有 admin 路由有对应 manual page')
process.exit(0)
