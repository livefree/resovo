/**
 * 124_card_size_settings_seed.test.ts — migration 124 seed ↔ CARD_SIZE_DEFAULTS 一致性（ADR-214 D-214-5）
 *
 * 真源：
 *   - apps/api/src/db/migrations/124_card_size_settings.sql（INSERT 字面量 seed，SQL 真源）
 *   - packages/types/src/card-size.types.ts（CARD_SIZE_DEFAULTS，TS 兜底真源）
 *
 * 为何需要：migration 纯 SQL 不能 import TS 常量 → seed 写字面量、与 CARD_SIZE_DEFAULTS 两份独立维护。
 * 本测解析 migration INSERT seed，逐档断言 == CARD_SIZE_DEFAULTS（值 + 档位集合双向），
 * 任一侧改值/增删档而另一侧未跟 → 红，防 DB seed ↔ 前端兜底漂移（D-214-5）。
 *
 * 纯文本解析单测（无 DB）；DB 级 schema/CHECK/seed 真库验证见
 * tests/integration/api/card-size-settings-schema.test.ts。
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CARD_SIZE_DEFAULTS, type CardSizeClass } from '@resovo/types'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MIGRATION_PATH = path.resolve(
  HERE,
  '../../../../apps/api/src/db/migrations/124_card_size_settings.sql',
)

interface ParsedSeedRow {
  desktopColumns: number | null
  cardWidthPx: number | null
  gapPx: number
}

/** SQL 字面量单元 → JS 值：NULL → null / '...' → string / 数字 → number */
function parseCell(raw: string): string | number | null {
  const t = raw.trim()
  if (/^null$/i.test(t)) return null
  const str = t.match(/^'(.*)'$/)
  if (str) return str[1]
  const n = Number(t)
  if (!Number.isInteger(n)) throw new Error(`无法解析 seed 单元: ${raw}`)
  return n
}

/** 解析 migration 124 的 INSERT ... VALUES seed → 按 size_class 归集的记录 */
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

describe('migration 124 seed ↔ CARD_SIZE_DEFAULTS 一致性（D-214-5 防漂移）', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8')
  const seed = parseSeed(sql)

  it('seed 档位集合 == CARD_SIZE_DEFAULTS 键集（增删档双向守）', () => {
    expect(Object.keys(seed).sort()).toEqual(Object.keys(CARD_SIZE_DEFAULTS).sort())
  })

  it.each(Object.keys(CARD_SIZE_DEFAULTS) as CardSizeClass[])(
    '档位 %s 的 SQL seed 值 == CARD_SIZE_DEFAULTS',
    (sizeClass) => {
      expect(seed[sizeClass]).toEqual(CARD_SIZE_DEFAULTS[sizeClass])
    },
  )
})
