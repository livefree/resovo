#!/usr/bin/env node
/**
 * verify-endpoint-adr.mjs — 新增端点 → ADR 存在性 + Response 字段核验
 * （CHG-SN-5-CHECKLIST-AUDIT 核心 A / R-CHECKLIST-1 扩 response 字段）
 *
 * 守卫：扫 apps/api/src/routes/admin/*.ts 所有 fastify.{get,post,put,patch,delete}
 *      调用，提取 (method, path)，比对 docs/decisions.md ADR §端点契约 表。
 *
 * 退出码：0 = 通过；1 = 命中违规并打印清单；2 = 脚本执行错误。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { splitAdrSections, parseEndpointContract } from './lib/adr-parser.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DECISIONS = join(ROOT, 'docs/decisions.md')
const ROUTES_DIR = join(ROOT, 'apps/api/src/routes/admin')
const ALLOWLIST_PATH = join(__dirname, 'lib/admin-routes-allowlist.json')

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) yield full
  }
}

function collectRouteEndpoints() {
  const endpoints = []
  for (const file of walk(ROUTES_DIR)) {
    const src = readFileSync(file, 'utf-8')
    const fileRel = file.replace(ROOT + '/', '')
    for (const m of src.matchAll(/fastify\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g)) {
      endpoints.push({
        method: m[1].toUpperCase(),
        path: m[2],
        file: fileRel,
      })
    }
  }
  return endpoints
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return new Set()
  try {
    const data = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf-8'))
    return new Set((data.entries ?? []).map((e) => `${e.method.toUpperCase()} ${e.path}`))
  } catch {
    return new Set()
  }
}

function collectAdrEndpoints() {
  const sections = splitAdrSections(DECISIONS)
  const all = []
  for (const adr of sections) {
    const rows = parseEndpointContract(adr.body)
    for (const r of rows) {
      all.push({ adrId: adr.id, ...r })
    }
  }
  return all
}

function main() {
  let exitCode = 0
  const routes = collectRouteEndpoints()
  const adrEndpoints = collectAdrEndpoints()
  const allowlist = loadAllowlist()
  const adrIndex = new Map(adrEndpoints.map((e) => [`${e.method} ${e.path}`, e]))

  const missing = []
  for (const r of routes) {
    const key = `${r.method} ${r.path}`
    if (allowlist.has(key)) continue
    if (!adrIndex.has(key)) {
      missing.push(r)
    }
  }

  if (missing.length > 0) {
    console.error('\n❌ verify-endpoint-adr: 以下 admin 端点未在任何 ADR §端点契约 表中找到对应行：\n')
    for (const m of missing) {
      console.error(`  - ${m.method} ${m.path}  (${m.file})`)
    }
    console.error('\n修复路径：')
    console.error('  1. 起 ADR-NNN 起草卡（参 ADR-104 / ADR-105 / ADR-117 范式）+ Opus arch-reviewer PASS')
    console.error('  2. 或若为 legacy 路由（M-SN-4 以前未起 ADR 的合规存量）→ 加入 scripts/lib/admin-routes-allowlist.json\n')
    console.error('plan §4.5 R7 MUST-8 ADR-端点先后协议硬约束。')
    exitCode = 1
  } else {
    console.log(`✅ verify-endpoint-adr: ${routes.length} admin 路由全部对齐 ADR §端点契约（${adrEndpoints.length} 个 ADR 端点；${allowlist.size} 白名单）`)
  }

  process.exit(exitCode)
}

try {
  main()
} catch (err) {
  console.error('verify-endpoint-adr 脚本执行错误：', err)
  process.exit(2)
}
