/**
 * image-health-checked-at.test.ts — updateCatalogImageStatus 的 checked_at 条件写入
 * （ADR-213 D-213-2/5：确定性判定写 <kind>_checked_at；pending_review 不写）
 *
 * 真函数 + mock db.query，断言生成的 SQL（worker 单测里 updateCatalogImageStatus 被 mock，无法覆盖此逻辑）。
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { updateCatalogImageStatus } from '@/api/db/queries/imageHealth'

function mockDb(): { db: Pool; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] })
  return { db: { query } as unknown as Pool, query }
}

describe('updateCatalogImageStatus — checked_at 条件写入（ADR-213 D-213-2/5）', () => {
  it('确定性 status=ok → 同步写 <kind>_checked_at=NOW()', async () => {
    const { db, query } = mockDb()
    await updateCatalogImageStatus(db, [{ catalogId: 'c1', kind: 'poster', status: 'ok' }])
    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain('poster_status = $1')
    expect(sql).toContain('poster_checked_at = NOW()')
    expect(params).toEqual(['ok', 'c1'])
  })

  it('broken / low_quality 亦写各自 <kind>_checked_at', async () => {
    const { db, query } = mockDb()
    await updateCatalogImageStatus(db, [
      { catalogId: 'c2', kind: 'backdrop', status: 'broken' },
      { catalogId: 'c3', kind: 'logo', status: 'low_quality' },
    ])
    expect(query.mock.calls[0][0]).toContain('backdrop_checked_at = NOW()')
    expect(query.mock.calls[1][0]).toContain('logo_checked_at = NOW()')
  })

  it('pending_review 非确定性判定 → 不写 checked_at（避免冒充已验证）', async () => {
    const { db, query } = mockDb()
    await updateCatalogImageStatus(db, [{ catalogId: 'c4', kind: 'poster', status: 'pending_review' }])
    const [sql] = query.mock.calls[0]
    expect(sql).toContain('poster_status = $1')
    expect(sql).not.toContain('checked_at')
  })

  it('missing 非确定性判定 → 不写 checked_at', async () => {
    const { db, query } = mockDb()
    await updateCatalogImageStatus(db, [{ catalogId: 'c5', kind: 'banner_backdrop', status: 'missing' }])
    expect(query.mock.calls[0][0]).not.toContain('checked_at')
  })
})
