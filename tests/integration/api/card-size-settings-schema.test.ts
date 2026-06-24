/**
 * card-size-settings-schema.test.ts — card_size_settings schema 真实 PG 集成测
 * （ADR-214 D-214-3 + Amendment A1 D-214-A1-3/4/5 + Amendment A2 D-214-A2-1/5 / SEQ-20260623-02 CARD-SIZE-A2-SCHEMA）
 *
 * 范围（migration 124 建表 + 125 size-driven + 126 单行全局后真库验证，与 unit mock 互补）：
 *   1. seed 单行全局存在且值正确（global card_width_px=160 / gap_px=16；compact/standard/scroll 均经演进退役/改名）
 *   2. card_width_px NOT NULL：写 NULL 被拒（23502 not_null_violation）
 *   3. card_width_px_check 范围（双层守边界第一层，D-214-A2-5）：∉ [120,400] 被拒（23514）
 *   4. gap_px 范围 ∉ [0,64] 被拒（23514）
 *   5. size_class 枚举（A2 仅 'global'）：'standard'/'scroll'/'compact'/枚举外值被拒（23514）
 *   6. desktop_columns 列经 126 删除：引用该列写入报 undefined_column（42703）
 *   7. 合法 UPDATE 在范围内通过（正向控制：global 改卡宽）
 *
 * 注：所有写尝试包在事务内并 ROLLBACK，不污染 dev DB（integration-pg 约定）。
 *     CHECK 违反 SQLSTATE 23514；NOT NULL 违反 23502；undefined_column 42703；非空 catch 提取 code（CLAUDE.md 禁空 catch）。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'

const PG_CHECK_VIOLATION = '23514'
const PG_NOT_NULL_VIOLATION = '23502'
const PG_UNDEFINED_COLUMN = '42703'

let db: Pool

beforeAll(() => {
  db = createIntegrationPool()
})

afterAll(async () => {
  await db.end()
})

interface WriteAttempt {
  readonly ok: boolean
  readonly code?: string
}

/**
 * 在独立事务内执行一条写语句并立即 ROLLBACK（不污染 dev DB）。
 * 成功 → { ok: true }；被 DB 约束拒 → { ok: false, code: SQLSTATE }。
 */
async function attemptWrite(sql: string, params?: unknown[]): Promise<WriteAttempt> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    try {
      await client.query(sql, params)
      await client.query('ROLLBACK')
      return { ok: true }
    } catch (err) {
      await client.query('ROLLBACK')
      const code = (err as { code?: string }).code
      return { ok: false, code }
    }
  } finally {
    client.release()
  }
}

describe('card_size_settings seed（migration 124 + 125 + 126）', () => {
  it('seed 恒存在单行全局：global（card_width_px=160 / gap_px=16；standard/scroll/compact 经演进退役/改名）', async () => {
    const { rows } = await db.query<{
      size_class: string
      card_width_px: number | null
      gap_px: number
    }>(
      `SELECT size_class, card_width_px, gap_px
         FROM card_size_settings
        ORDER BY size_class`
    )
    const bySize = Object.fromEntries(rows.map((r) => [r.size_class, r]))

    expect(Object.keys(bySize).sort()).toEqual(['global'])
    expect(bySize.global).toMatchObject({ card_width_px: 160, gap_px: 16 })
    expect(bySize.standard).toBeUndefined()
    expect(bySize.scroll).toBeUndefined()
    expect(bySize.compact).toBeUndefined()
  })

  it('id 为 UUID（audit target_id 锚点）+ settings 默认空对象', async () => {
    const { rows } = await db.query<{ id: string; settings: Record<string, unknown> }>(
      `SELECT id, settings FROM card_size_settings WHERE size_class = 'global'`
    )
    expect(rows[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(rows[0].settings).toEqual({})
  })
})

describe('card_size_settings card_width_px NOT NULL', () => {
  it('global 卡宽置 NULL 被拒（NOT NULL violation 23502）', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = NULL WHERE size_class = 'global'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_NOT_NULL_VIOLATION)
  })
})

describe('card_size_settings card_width_px_check 范围（双层守边界第一层，D-214-A2-5）', () => {
  it('card_width_px 越上界（401 > 400）被拒', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = 401 WHERE size_class = 'global'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })

  it('card_width_px 越下界（119 < 120）被拒', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = 119 WHERE size_class = 'global'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })

  it('card_width_px=350（[120,400] 内）通过', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = 350 WHERE size_class = 'global'`
    )
    expect(r.ok).toBe(true)
  })

  it('gap_px 越上界（65 > 64）被拒', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET gap_px = 65 WHERE size_class = 'global'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })
})

describe('card_size_settings size_class 枚举 CHECK（A2 仅 global）', () => {
  it.each(['standard', 'scroll', 'compact', 'huge'])(
    '枚举外 size_class（%s）插入被拒（23514）',
    async (cls) => {
      const r = await attemptWrite(
        `INSERT INTO card_size_settings (size_class, card_width_px, gap_px)
         VALUES ($1, 200, 16)`,
        [cls],
      )
      expect(r.ok).toBe(false)
      expect(r.code).toBe(PG_CHECK_VIOLATION)
    },
  )
})

describe('card_size_settings desktop_columns 列经 126 删除', () => {
  it('引用已删 desktop_columns 列写入报 undefined_column（42703）', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET desktop_columns = 6 WHERE size_class = 'global'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_UNDEFINED_COLUMN)
  })
})

describe('card_size_settings 合法写（正向控制，范围内）', () => {
  it('global 卡宽改 250（范围内）通过', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = 250 WHERE size_class = 'global'`
    )
    expect(r.ok).toBe(true)
  })

  it('global gap 改 24（范围内）通过', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET gap_px = 24 WHERE size_class = 'global'`
    )
    expect(r.ok).toBe(true)
  })
})
