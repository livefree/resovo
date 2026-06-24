/**
 * 124_card_size_settings_seed.test.ts — card_size_settings 净 seed 态 ↔ CARD_SIZE_DEFAULTS 一致性
 * （ADR-214 D-214-5 + Amendment A1 D-214-A1-1/3/5 + Amendment A2 D-214-A2-1/5）
 *
 * 真源（净 seed 态 = 124 INSERT 经 125 + 126 演进）：
 *   - apps/api/src/db/migrations/124_card_size_settings.sql（INSERT 字面量 seed 3 行）
 *   - apps/api/src/db/migrations/125_card_size_a1_size_driven.sql（UPDATE standard 卡宽 + DELETE compact）
 *   - apps/api/src/db/migrations/126_card_size_a2_global.sql（DELETE scroll + standard→global/160 + DROP desktop_columns）
 *   - packages/types/src/card-size.types.ts（CARD_SIZE_DEFAULTS，TS 兜底真源）
 *
 * 为何需要：migration 纯 SQL 不能 import TS 常量 → seed 写字面量、与 CARD_SIZE_DEFAULTS 两份独立维护。
 * 本测解析 124 INSERT seed、依次应用 125 + 126 的 DELETE/UPDATE/DROP COLUMN 演进得「净 seed 态」，
 * 断言 == CARD_SIZE_DEFAULTS（值 + 档位集合双向），任一侧漂移 → 红，防 DB seed ↔ 前端兜底漂移（D-214-5）。
 *
 * Amendment A2：standard 经 125→(NULL,200,16)、经 126 改名 global + 卡宽 160 + 删 desktop_columns 列；
 *   compact 经 125 退役、scroll 经 126 退役 → 净 seed 仅 global { cardWidthPx:160, gapPx:16 }。
 * 解析前剥离 `--` 注释行（down 段注释含回滚 DML，不剥离会被 DML 正则误匹配）。
 *
 * 纯文本解析单测（无 DB）；DB 级 schema/CHECK/seed 真库验证见 tests/integration/api/card-size-settings-schema.test.ts。
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CARD_SIZE_DEFAULTS, type CardSizeClass } from '@resovo/types'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.resolve(HERE, '../../../../apps/api/src/db/migrations')
const SEED_MIGRATION = path.join(MIGRATIONS_DIR, '124_card_size_settings.sql')
const A1_MIGRATION = path.join(MIGRATIONS_DIR, '125_card_size_a1_size_driven.sql')
const A2_MIGRATION = path.join(MIGRATIONS_DIR, '126_card_size_a2_global.sql')

/** 行值列（camelCase key → number|null）；size_class 作为外层 key、不入行体。 */
type ParsedSeedRow = Record<string, number | null>

/** seed 值列 → camelCase key 映射（仅这些列入行体，便于与 CARD_SIZE_DEFAULTS 比对 + DROP COLUMN 剥离） */
const COLUMN_TO_KEY: Record<string, string> = {
  desktop_columns: 'desktopColumns',
  card_width_px: 'cardWidthPx',
  gap_px: 'gapPx',
}

/** 剥离 `--` 注释行（含 down 段注释的回滚 DML，避免被 applyMigration 的 DML 正则误匹配） */
function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
}

/** SQL 字面量单元 → JS 值：NULL → null / '...' → string / 数字 → number */
function parseCell(raw: string): string | number | null {
  const t = raw.trim()
  if (/^null$/i.test(t)) return null
  const str = t.match(/^'(.*)'$/)
  if (str) return str[1]
  const n = Number(t)
  if (!Number.isInteger(n)) throw new Error(`无法解析 SQL 单元: ${raw}`)
  return n
}

/** 解析 124 INSERT ... VALUES seed → 按 size_class 归集（仅 COLUMN_TO_KEY 值列入行体） */
function parseSeed(sql: string): Record<string, ParsedSeedRow> {
  const insert = sql.match(
    /INSERT INTO card_size_settings\s*\(([^)]+)\)\s*VALUES([\s\S]+?)ON CONFLICT/i,
  )
  if (!insert) throw new Error('migration 124 未找到预期的 INSERT ... VALUES ... ON CONFLICT seed 块')

  const columns = insert[1].split(',').map((c) => c.trim())
  const tuples = insert[2].match(/\(([^)]+)\)/g)
  if (!tuples) throw new Error('migration 124 seed 块未解析出任何 VALUES 元组')

  const out: Record<string, ParsedSeedRow> = {}
  for (const tuple of tuples) {
    const cells = tuple.slice(1, -1).split(',').map(parseCell)
    const record = Object.fromEntries(columns.map((col, idx) => [col, cells[idx]]))
    const sizeClass = record.size_class
    if (typeof sizeClass !== 'string') throw new Error(`seed 元组缺 size_class: ${tuple}`)
    const row: ParsedSeedRow = {}
    for (const [col, key] of Object.entries(COLUMN_TO_KEY)) {
      row[key] = record[col] as number | null
    }
    out[sizeClass] = row
  }
  return out
}

/**
 * 应用单条 migration 的 seed 演进到当前态。
 * 识别本体系 migration 用到的三类 DML：
 *   - DELETE WHERE size_class = '...'（退役档位）
 *   - UPDATE SET ... WHERE size_class = '...'（改值 + 可选 size_class 改名，如 126 standard→global）
 *   - ALTER TABLE ... DROP COLUMN [IF EXISTS] ...（删列，如 126 删 desktop_columns → 从所有行剥离该 key）
 * 非 seed 的 DROP/ADD CONSTRAINT / ALTER COLUMN SET NOT NULL 不影响 seed 值故忽略。输入须已剥离注释。
 */
function applyMigration(
  state: Record<string, ParsedSeedRow>,
  sql: string,
): Record<string, ParsedSeedRow> {
  const next: Record<string, ParsedSeedRow> = Object.fromEntries(
    Object.entries(state).map(([k, v]) => [k, { ...v }]),
  )

  for (const m of sql.matchAll(
    /DELETE FROM card_size_settings\s+WHERE size_class\s*=\s*'(\w+)'/gi,
  )) {
    delete next[m[1]]
  }

  for (const m of sql.matchAll(
    /UPDATE card_size_settings\s+SET\s+([\s\S]+?)\s+WHERE size_class\s*=\s*'(\w+)'/gi,
  )) {
    const whereCls = m[2]
    const row = next[whereCls]
    if (!row) continue
    let renameTo: string | null = null
    for (const assign of m[1].split(',')) {
      const [col, val] = assign.split('=').map((s) => s.trim())
      if (col === 'size_class') {
        const parsed = parseCell(val)
        if (typeof parsed === 'string') renameTo = parsed
        continue
      }
      const key = COLUMN_TO_KEY[col]
      if (!key) continue
      const parsed = parseCell(val)
      if (parsed !== null && typeof parsed !== 'number') continue // seed 数值列不应为 string
      row[key] = parsed
    }
    if (renameTo && renameTo !== whereCls) {
      delete next[whereCls]
      next[renameTo] = row
    }
  }

  for (const m of sql.matchAll(
    /ALTER TABLE card_size_settings\s+DROP COLUMN(?:\s+IF EXISTS)?\s+(\w+)/gi,
  )) {
    const key = COLUMN_TO_KEY[m[1]]
    if (!key) continue
    for (const row of Object.values(next)) delete row[key]
  }

  return next
}

describe('card_size_settings 净 seed 态（124 + 125 + 126）↔ CARD_SIZE_DEFAULTS 一致性（D-214-5 防漂移）', () => {
  const seed124 = parseSeed(stripSqlComments(readFileSync(SEED_MIGRATION, 'utf8')))
  const afterA1 = applyMigration(seed124, stripSqlComments(readFileSync(A1_MIGRATION, 'utf8')))
  const netSeed = applyMigration(afterA1, stripSqlComments(readFileSync(A2_MIGRATION, 'utf8')))

  it('净 seed 档位集合 == CARD_SIZE_DEFAULTS 键集（增删档双向守；A2 仅 global）', () => {
    expect(Object.keys(netSeed).sort()).toEqual(Object.keys(CARD_SIZE_DEFAULTS).sort())
  })

  it.each(Object.keys(CARD_SIZE_DEFAULTS) as CardSizeClass[])(
    '档位 %s 的净 seed 值 == CARD_SIZE_DEFAULTS',
    (sizeClass) => {
      expect(netSeed[sizeClass]).toEqual(CARD_SIZE_DEFAULTS[sizeClass])
    },
  )

  it('125 演进 standard（→卡宽 200/列数 null）并退役 compact（防 125 漏改静默回退）', () => {
    expect(seed124.standard).toEqual({ desktopColumns: 5, cardWidthPx: null, gapPx: 16 })
    expect(seed124.compact).toBeDefined()
    expect(afterA1.standard).toEqual({ desktopColumns: null, cardWidthPx: 200, gapPx: 16 })
    expect(afterA1.compact).toBeUndefined()
  })

  it('126 演进 standard→global（卡宽 160 + 删 desktop_columns 列）并退役 scroll（防 126 漏改静默回退）', () => {
    expect(afterA1.scroll).toBeDefined()
    expect(netSeed.global).toEqual({ cardWidthPx: 160, gapPx: 16 })
    expect(netSeed.standard).toBeUndefined()
    expect(netSeed.scroll).toBeUndefined()
    // desktop_columns 列经 126 DROP COLUMN 剥离 → 净 seed 行不含该 key
    expect(netSeed.global).not.toHaveProperty('desktopColumns')
  })
})
