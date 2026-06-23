/**
 * 124_card_size_settings_seed.test.ts — card_size_settings 净 seed 态 ↔ CARD_SIZE_DEFAULTS 一致性
 * （ADR-214 D-214-5 + Amendment A1 D-214-A1-1/3/5）
 *
 * 真源（净 seed 态 = 124 INSERT 经 125 演进）：
 *   - apps/api/src/db/migrations/124_card_size_settings.sql（INSERT 字面量 seed）
 *   - apps/api/src/db/migrations/125_card_size_a1_size_driven.sql（UPDATE standard 卡宽 + DELETE compact）
 *   - packages/types/src/card-size.types.ts（CARD_SIZE_DEFAULTS，TS 兜底真源）
 *
 * 为何需要：migration 纯 SQL 不能 import TS 常量 → seed 写字面量、与 CARD_SIZE_DEFAULTS 两份独立维护。
 * 本测解析 124 INSERT seed、应用 125 的 DELETE/UPDATE 演进得「净 seed 态」，逐档断言 == CARD_SIZE_DEFAULTS
 * （值 + 档位集合双向），任一侧改值/增删档而另一侧未跟 → 红，防 DB seed ↔ 前端兜底漂移（D-214-5）。
 *
 * Amendment A1：standard 由 (5,null,16) 经 125 演进为 (null,200,16)；compact 经 125 DELETE 退役。
 * 解析前剥离 `--` 注释行（125 down 段注释含回滚 UPDATE/INSERT，不剥离会被 DML 正则误匹配）。
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

interface ParsedSeedRow {
  desktopColumns: number | null
  cardWidthPx: number | null
  gapPx: number
}

/** 剥离 `--` 注释行（含 down 段注释的回滚 DML，避免被 applyA1 的 DML 正则误匹配） */
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

/** 解析 124 INSERT ... VALUES seed → 按 size_class 归集 */
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
    out[sizeClass] = {
      desktopColumns: record.desktop_columns as number | null,
      cardWidthPx: record.card_width_px as number | null,
      gapPx: record.gap_px as number,
    }
  }
  return out
}

const SEED_COLUMN_TO_KEY: Record<string, keyof ParsedSeedRow> = {
  desktop_columns: 'desktopColumns',
  card_width_px: 'cardWidthPx',
  gap_px: 'gapPx',
}

/**
 * 应用 125 的 seed 演进（DELETE + UPDATE）到 124 净 seed 态。
 * 仅识别本 migration 用到的两类 DML（DELETE WHERE size_class / UPDATE SET ... WHERE size_class），
 * 足以推导净 seed 态；非 seed 的 ALTER/CHECK 不影响 seed 值故忽略。输入须已剥离注释。
 */
function applyA1(seed: Record<string, ParsedSeedRow>, sql: string): Record<string, ParsedSeedRow> {
  // 逐行深拷贝（浅拷贝会令 next[cls] 与入参 seed[cls] 共享对象引用，UPDATE mutate 污染入参 seed124）
  const next: Record<string, ParsedSeedRow> = Object.fromEntries(
    Object.entries(seed).map(([k, v]) => [k, { ...v }]),
  )

  for (const m of sql.matchAll(
    /DELETE FROM card_size_settings\s+WHERE size_class\s*=\s*'(\w+)'/gi,
  )) {
    delete next[m[1]]
  }

  for (const m of sql.matchAll(
    /UPDATE card_size_settings\s+SET\s+([\s\S]+?)\s+WHERE size_class\s*=\s*'(\w+)'/gi,
  )) {
    const cls = m[2]
    const row = next[cls]
    if (!row) continue
    for (const assign of m[1].split(',')) {
      const [col, val] = assign.split('=').map((s) => s.trim())
      const key = SEED_COLUMN_TO_KEY[col]
      if (!key) continue
      const parsed = parseCell(val)
      if (parsed !== null && typeof parsed !== 'number') continue // seed 数值列不应为 string
      ;(row as Record<keyof ParsedSeedRow, number | null>)[key] = parsed
    }
  }
  return next
}

describe('card_size_settings 净 seed 态（124 + 125）↔ CARD_SIZE_DEFAULTS 一致性（D-214-5 防漂移）', () => {
  const seed124 = parseSeed(stripSqlComments(readFileSync(SEED_MIGRATION, 'utf8')))
  const netSeed = applyA1(seed124, stripSqlComments(readFileSync(A1_MIGRATION, 'utf8')))

  it('净 seed 档位集合 == CARD_SIZE_DEFAULTS 键集（增删档双向守；compact 经 125 退役）', () => {
    expect(Object.keys(netSeed).sort()).toEqual(Object.keys(CARD_SIZE_DEFAULTS).sort())
  })

  it.each(Object.keys(CARD_SIZE_DEFAULTS) as CardSizeClass[])(
    '档位 %s 的净 seed 值 == CARD_SIZE_DEFAULTS',
    (sizeClass) => {
      expect(netSeed[sizeClass]).toEqual(CARD_SIZE_DEFAULTS[sizeClass])
    },
  )

  it('125 确实演进 standard（→卡宽 200/列数 null）并退役 compact（防 125 漏改静默回退）', () => {
    expect(seed124.standard).toEqual({ desktopColumns: 5, cardWidthPx: null, gapPx: 16 })
    expect(seed124.compact).toBeDefined()
    expect(netSeed.standard).toEqual({ desktopColumns: null, cardWidthPx: 200, gapPx: 16 })
    expect(netSeed.compact).toBeUndefined()
  })
})
