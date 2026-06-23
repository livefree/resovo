/**
 * card-size-settings-schema.test.ts — card_size_settings schema 真实 PG 集成测
 * （ADR-214 D-214-3 / Codex-R1 HIGH 倒置行守卫 / SEQ-20260622-03 Phase 1 CARD-SIZE-DB）
 *
 * 范围（migration 124 落地后真库验证，与 unit mock 互补）：
 *   1. seed 3 行存在且值正确（standard 5/null/16、compact 3/null/12、scroll null/170/16）
 *   2. 档位×单位绑定 CHECK（card_size_settings_unit_by_class_check）：
 *      - 倒置行被拒：scroll 带 desktop_columns / 网格档带 card_width_px（Codex-R1 核心断言）
 *   3. 范围 CHECK：desktop_columns ∉ [2,8] / card_width_px ∉ [120,280] / gap_px ∉ [0,64] 被拒
 *   4. size_class 枚举外值被拒
 *   5. 合法 UPDATE 在范围内通过（正向控制）
 *
 * 注：所有写尝试包在事务内并 ROLLBACK，不污染 dev DB（integration-pg 约定）。
 *     CHECK 违反断言 SQLSTATE 23514（check_violation）；非空 catch 提取 code（CLAUDE.md 禁空 catch）。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'

const PG_CHECK_VIOLATION = '23514'

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

describe('card_size_settings seed（migration 124）', () => {
  it('seed 恒存在 3 行：standard / compact / scroll', async () => {
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

    expect(Object.keys(bySize).sort()).toEqual(['compact', 'scroll', 'standard'])

    // 网格档存列数·卡宽空；scroll 档存卡宽·列数空（D-214-3 默认值）
    expect(bySize.standard).toMatchObject({ desktop_columns: 5, card_width_px: null, gap_px: 16 })
    expect(bySize.compact).toMatchObject({ desktop_columns: 3, card_width_px: null, gap_px: 12 })
    expect(bySize.scroll).toMatchObject({ desktop_columns: null, card_width_px: 170, gap_px: 16 })
  })

  it('id 为 UUID（audit target_id 锚点）+ settings 默认空对象', async () => {
    const { rows } = await db.query<{ id: string; settings: Record<string, unknown> }>(
      `SELECT id, settings FROM card_size_settings WHERE size_class = 'standard'`
    )
    expect(rows[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(rows[0].settings).toEqual({})
  })
})

describe('card_size_settings 档位×单位绑定 CHECK（Codex-R1 倒置行守卫）', () => {
  it('倒置：scroll 档带 desktop_columns（缺 card_width_px）被拒', async () => {
    // UPDATE 既有 scroll 行制造倒置，避开 UNIQUE 干扰；ROLLBACK 不污染
    const r = await attemptWrite(
      `UPDATE card_size_settings
          SET desktop_columns = 5, card_width_px = NULL
        WHERE size_class = 'scroll'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })

  it('倒置：网格档（standard）带 card_width_px（缺 desktop_columns）被拒', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings
          SET desktop_columns = NULL, card_width_px = 200
        WHERE size_class = 'standard'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })

  it('倒置：compact 同时带列数与卡宽被拒', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings
          SET card_width_px = 170
        WHERE size_class = 'compact'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })
})

describe('card_size_settings 范围 CHECK（双层守边界第一层，D-214-10）', () => {
  it('desktop_columns 越上界（9 > 8）被拒', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET desktop_columns = 9 WHERE size_class = 'standard'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })

  it('desktop_columns 越下界（1 < 2）被拒', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET desktop_columns = 1 WHERE size_class = 'standard'`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })

  it('card_width_px 越上界（300 > 280）被拒', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = 300 WHERE size_class = 'scroll'`
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

describe('card_size_settings size_class 枚举 CHECK', () => {
  it('枚举外 size_class（huge）被拒', async () => {
    // 带合法单位列以隔离出 size_class CHECK（非单位绑定 CHECK / 非 UNIQUE）
    const r = await attemptWrite(
      `INSERT INTO card_size_settings (size_class, desktop_columns, gap_px)
       VALUES ('huge', 5, 16)`
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe(PG_CHECK_VIOLATION)
  })
})

describe('card_size_settings 合法写（正向控制，范围内 + 单位匹配）', () => {
  it('standard 列数改 6（范围内）通过', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET desktop_columns = 6 WHERE size_class = 'standard'`
    )
    expect(r.ok).toBe(true)
  })

  it('scroll 卡宽改 200（范围内）通过', async () => {
    const r = await attemptWrite(
      `UPDATE card_size_settings SET card_width_px = 200 WHERE size_class = 'scroll'`
    )
    expect(r.ok).toBe(true)
  })
})
