/**
 * card-size-settings-schema.test.ts — card_size_settings schema 真实 PG 集成测
 * （ADR-214 D-214-3 + Amendment A1 D-214-A1-3/4/5 / SEQ-20260623-01 CARD-SIZE-A1-SCHEMA）
 *
 * 范围（migration 124 建表 + 125 size-driven 翻转后真库验证，与 unit mock 互补）：
 *   1. seed 2 档存在且值正确（standard null/200/16、scroll null/170/16；compact 经 125 退役）
 *   2. card_width_px 全档 NOT NULL（A1）：写 NULL 被拒（23502 not_null_violation）——
 *      取代原「档位×单位绑定」倒置守卫（单位统一为卡宽后倒置不再可能；standard 带 card_width_px 现为合法态）
 *   3. size_unit_check 范围（双层守边界第一层，D-214-A1-5）：
 *      card_width_px ∉ [120,400] / desktop_columns 护栏 ∉ [2,8] / gap_px ∉ [0,64] 被拒（23514）
 *   4. size_class 枚举（compact 经 125 退役）：'compact'/枚举外值被拒（23514）
 *   5. 合法 UPDATE 在范围内通过（正向控制：standard/scroll 改卡宽、standard 设列数护栏）
 *
 * 注：所有写尝试包在事务内并 ROLLBACK，不污染 dev DB（integration-pg 约定）。
 *     CHECK 违反 SQLSTATE 23514；NOT NULL 违反 23502；非空 catch 提取 code（CLAUDE.md 禁空 catch）。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'

const PG_CHECK_VIOLATION = '23514'
const PG_NOT_NULL_VIOLATION = '23502'

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

describe('card_size_settings seed（migration 124 + 125）', () => {
  it('seed 恒存在 2 档：standard / scroll（compact 经 125 退役）', async () => {
    const { rows } = await db.query<{
      size_class: string
      desktop_columns: number | null
      card_width_px: number | null
      gap_px: number
    }>(
      `SELECT size_class, desktop_columns, card_width_px, gap_px
         FROM card_size_settings
        ORDER BY size_class`
    )
    const bySize = Object.fromEntries(rows.map((r) => [r.size_class, r]))

    expect(Object.keys(bySize).sort()).toEqual(['scroll', 'standard'])

    // 全档存卡宽 px（size-driven，A1）；desktop_columns 退化护栏、本轮 null
    expect(bySize.standard).toMatchObject({ desktop_columns: null, card_width_px: 200, gap_px: 16 })
    expect(bySize.scroll).toMatchObject({ desktop_columns: null, card_width_px: 170, gap_px: 16 })
    expect(bySize.compact).toBeUndefined()
  })

  it('id 为 UUID（audit target_id 锚点）+ settings 默认空对象', async () => {
    const { rows } = await db.query<{ id: string; settings: Record<string, unknown> }>(
      `SELECT id, settings FROM card_size_settings WHERE size_class = 'standard'`
    )
    expect(rows[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(rows[0].settings).toEqual({})
  })
})

describe('card_size_settings card_width_px 全档 NOT NULL（A1：取代档位×单位倒置守卫）', () => {
  it('scroll 档卡宽置 NULL 被拒（NOT NULL violation 23502）', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = NULL WHERE size_class = 'scroll'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_NOT_NULL_VIOLATION)
  })

  it('standard 档卡宽置 NULL 被拒（NOT NULL violation 23502）', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = NULL WHERE size_class = 'standard'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_NOT_NULL_VIOLATION)
  })

  it('倒置语义消解：standard 带 card_width_px（A1 后为合法常态，非倒置）通过', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = 220, desktop_columns = NULL WHERE size_class = 'standard'`
    )
    expect(r.ok).toBe(true)
  })
})

describe('card_size_settings size_unit_check 范围（双层守边界第一层，D-214-A1-5）', () => {
  it('card_width_px 越上界（401 > 400）被拒', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = 401 WHERE size_class = 'standard'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })

  it('card_width_px 越下界（119 < 120）被拒', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = 119 WHERE size_class = 'scroll'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })

  it('放宽后 card_width_px=350（原 [120,280] 拒、新 [120,400] 允）通过', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = 350 WHERE size_class = 'standard'`
    )
    expect(r.ok).toBe(true)
  })

  it('desktop_columns 护栏越上界（9 > 8）被拒', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET desktop_columns = 9 WHERE size_class = 'standard'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })

  it('desktop_columns 护栏越下界（1 < 2）被拒', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET desktop_columns = 1 WHERE size_class = 'standard'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })

  it('gap_px 越上界（65 > 64）被拒', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET gap_px = 65 WHERE size_class = 'standard'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })
})

describe('card_size_settings size_class 枚举 CHECK（compact 经 125 退役）', () => {
  it('退役档 compact（A1 后枚举外）插入被拒', async () => {
    const r = await attemptWrite(
      `INSERT INTO card_size_settings (size_class, card_width_px, gap_px)
       VALUES ('compact', 170, 12)`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })

  it('枚举外 size_class（huge）插入被拒', async () => {
    const r = await attemptWrite(
      `INSERT INTO card_size_settings (size_class, card_width_px, gap_px)
       VALUES ('huge', 200, 16)`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })
})

describe('card_size_settings 合法写（正向控制，范围内）', () => {
  it('standard 卡宽改 250（范围内）通过', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = 250 WHERE size_class = 'standard'`
    )
    expect(r.ok).toBe(true)
  })

  it('scroll 卡宽改 200（范围内）通过', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = 200 WHERE size_class = 'scroll'`
    )
    expect(r.ok).toBe(true)
  })

  it('standard 设 desktop_columns=6 列数护栏（卡宽仍非空）通过', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET desktop_columns = 6 WHERE size_class = 'standard'`
    )
    expect(r.ok).toBe(true)
  })
})
