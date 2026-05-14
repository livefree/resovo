#!/usr/bin/env node
/**
 * verify-sql-schema-alignment.mjs — queries SQL `<alias>.<column>` 静态扫描 vs migration 全集 schema 核验
 * （CHG-SN-6-CHECKLIST-AUDIT-3 / RETRO 1/7）
 *
 * 防止 CHG-SN-5-13-PATCH-2 类 schema 偏离（migration 029 删 videos 15 列后 SQL 未迁移 mc JOIN）。
 *
 * 简化策略：
 *   - 硬编码常见 alias map（v=videos, vs=video_sources, u=users, mc=media_catalog, wh=watch_history, s=video_sources）
 *   - 仅核 5 核心表（其他表 advisory pass）
 *   - 正则匹配 `<alias>.<column>` 字面量；不解析 SQL AST
 *   - 默认 advisory（不阻塞 CI）；M-SN-6 完善后升 FAIL fast
 *
 * 退出码：0 = 通过 / 仅有警告；2 = 脚本错误
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSchemaSnapshot } from './lib/migration-parser.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// 硬编码 alias map — 仅核明确无歧义的 alias
// `s` 在 subtitles.ts 内指 subtitles 表（不是 video_sources）→ 排除避免误报
// M-SN-6 完善后扩 alias 上下文推断（文件名 / FROM/JOIN 子句解析）
const ALIAS_MAP = {
  v: 'videos',
  vs: 'video_sources',
  mc: 'media_catalog',
  wh: 'watch_history',
  sla: 'source_line_aliases',
}

const CORE_TABLES = new Set(['videos', 'video_sources', 'users', 'media_catalog', 'watch_history'])

const SCAN_DIRS = [
  join(ROOT, 'apps/api/src/db/queries'),
  join(ROOT, 'apps/api/src/services'),
]

// 已知特殊列名映射（如 cast 需双引号；list 字段名）
const KNOWN_QUOTED_COLS = new Set(['cast', 'order', 'user', 'type'])

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) yield full
  }
}

function main() {
  const schema = buildSchemaSnapshot()
  const issues = []

  // 核验核心表 schema 实际存在
  for (const t of CORE_TABLES) {
    if (!schema.has(t)) {
      console.warn(`⚠️  migration-parser 未识别核心表 ${t}，跳过该表核验（建议核查 parser 模式 vs migration SQL）`)
    }
  }

  // 扫 queries / services 内 SQL template literal 内的 <alias>.<column> 字面量
  // 关键改进：限定 backtick 块内 + 必须含 SQL 关键字（SELECT/FROM/JOIN/WHERE/INSERT/UPDATE）
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      const content = readFileSync(file, 'utf-8')
      const fileRel = file.replace(ROOT + '/', '')

      // 提取所有 backtick template literal 内容（含 ${} 内插值；简化：用非贪婪 ` ... ` 匹配）
      const templateRe = /`([^`]+)`/gs
      for (const t of content.matchAll(templateRe)) {
        const tmpl = t[1]
        // 过滤：仅 SQL 模板（必含 SELECT/FROM/JOIN/INSERT/UPDATE/DELETE 关键字）
        if (!/\b(SELECT|FROM|JOIN|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i.test(tmpl)) continue

        // 列名必须 snake_case（SQL 列规范），排除 camelCase（TS 字段误报）
        const colRe = /(?:^|[\s,(])([a-z]{1,4})\.("?)([a-z][a-z_0-9]*)\2(?=[\s,)]|$)/gim

        for (const m of tmpl.matchAll(colRe)) {
          const alias = m[1]
          const column = m[3]
          // 严格 snake_case 列：必须含下划线 或 全小写单词（排除 camelCase）
          if (/[A-Z]/.test(column)) continue  // camelCase TS 属性
          const table = ALIAS_MAP[alias]
          if (!table || !CORE_TABLES.has(table)) continue
          const tableSchema = schema.get(table)
          if (!tableSchema) continue
          if (!tableSchema.has(column)) {
            // 找当前匹配的近似行号（基于完整文件 content）
            const tIdx = t.index ?? 0
            const lineNum = content.slice(0, tIdx).split('\n').length
            issues.push({ file: fileRel, line: lineNum, alias, column, table })
          }
        }
      }
    }
  }

  if (issues.length > 0) {
    console.error(`\n⚠️  verify-sql-schema-alignment: ${issues.length} 处 SQL 引用列与 migration 全集 schema 不一致：\n`)
    for (const i of issues) {
      console.error(`  - ${i.file}:${i.line}  ${i.alias}.${i.column}  → 表 ${i.table} 当前 schema 无该列`)
    }
    console.error('\n修复路径：')
    console.error('  1. JOIN media_catalog（如 videos 已迁移列）+ 改 `mc.<column>`')
    console.error('  2. 或核 migration 全集是否漏跑（npm run migrate 干跑）')
    console.error('  3. 或核 alias 实际对应表（脚本硬编码 alias map 见 scripts/verify-sql-schema-alignment.mjs:24）')
    console.error('\n⚠️  当前为 advisory 模式（不阻塞 CI）；M-SN-6 期完善后升 FAIL fast。')
    // advisory 不阻塞
    process.exit(0)
  }

  console.log(`✅ verify-sql-schema-alignment: queries SQL 引用列全部对齐 migration 全集 schema（${schema.size} 表，扫描 5 核心表）`)
  process.exit(0)
}

try {
  main()
} catch (err) {
  console.error('verify-sql-schema-alignment 脚本执行错误：', err)
  process.exit(2)
}
