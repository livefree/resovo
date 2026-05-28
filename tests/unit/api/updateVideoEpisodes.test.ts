/**
 * updateVideoEpisodes.test.ts — auto / manual mode SQL 守卫 + no-op contract
 *（CHG-367-B-A / ADR-163 D-163-6 / Codex stop-time review #15）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock pg Pool capture SQL + params
function makeMockPool(rowCount = 1) {
  const query = vi.fn().mockResolvedValue({ rowCount, rows: [] })
  return { query } as unknown as import('pg').Pool
}

import { updateVideoEpisodes } from '@/api/db/queries/videos'

describe('updateVideoEpisodes — auto / manual mode SQL 契约', () => {
  let pool: ReturnType<typeof makeMockPool>
  let query: import('vitest').Mock

  beforeEach(() => {
    pool = makeMockPool(1)
    query = (pool as unknown as { query: import('vitest').Mock }).query
  })

  it('manual mode → SET 直接覆盖 / WHERE 仅 id + deleted_at（无守卫）', async () => {
    await updateVideoEpisodes(pool, 'v1', { totalEpisodes: 24, currentEpisodes: 12 }, 'manual')
    const [sql, params] = query.mock.calls[0]
    expect(sql).toMatch(/total_episodes = \$1/)
    expect(sql).toMatch(/current_episodes = \$2/)
    expect(sql).not.toMatch(/COALESCE/)
    expect(sql).toMatch(/WHERE id = \$\d+ AND deleted_at IS NULL$/)
    expect(params).toEqual([24, 12, 'v1'])
  })

  it('auto mode → SET COALESCE 仅写 NULL / WHERE 加守卫（至少一列实际 NULL→非 NULL 才 touch）', async () => {
    await updateVideoEpisodes(pool, 'v1', { totalEpisodes: 24 }, 'auto')
    const [sql, params] = query.mock.calls[0]
    // SET 使用 COALESCE 保守
    expect(sql).toMatch(/total_episodes = COALESCE\(total_episodes, \$1\)/)
    // WHERE 加守卫：原子件 + (列 IS NULL AND $::INT IS NOT NULL)
    expect(sql).toMatch(/\(total_episodes IS NULL AND \$1::INT IS NOT NULL\)/)
    expect(params).toEqual([24, 'v1'])
  })

  it('auto mode 两列同传 → 守卫用 OR 连接（任一列 NULL → 非 NULL 触发 UPDATE）', async () => {
    await updateVideoEpisodes(pool, 'v1', { totalEpisodes: 24, currentEpisodes: 12 }, 'auto')
    const [sql] = query.mock.calls[0]
    expect(sql).toMatch(/AND \(\(total_episodes IS NULL.*\) OR \(current_episodes IS NULL.*\)\)/s)
  })

  it('空 input → 不调 query / 返回 false（no-op 防御）', async () => {
    const ret = await updateVideoEpisodes(pool, 'v1', {}, 'auto')
    expect(ret).toBe(false)
    expect(query).not.toHaveBeenCalled()
  })

  it('PG 返回 rowCount=0（auto 守卫拒绝 / 视频不存在）→ 返回 false', async () => {
    pool = makeMockPool(0)
    const ret = await updateVideoEpisodes(pool, 'v1', { totalEpisodes: 24 }, 'auto')
    expect(ret).toBe(false)
  })

  it('updated_at 总是包含在 SET（行实际更新时刷新 / 守卫阻止则 SQL 不执行更新 / no-op contract）', async () => {
    await updateVideoEpisodes(pool, 'v1', { totalEpisodes: 24 }, 'auto')
    const [sql] = query.mock.calls[0]
    expect(sql).toMatch(/updated_at = NOW\(\)/)
  })
})
