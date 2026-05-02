/**
 * tests/unit/api/reviewLabelsQuery.test.ts
 * CHG-SN-4-05: reviewLabels query — listActiveReviewLabels / findReviewLabelByKey
 */

import { describe, it, expect, vi } from 'vitest'
import { listActiveReviewLabels, findReviewLabelByKey } from '@/api/db/queries/reviewLabels'

function makeDb(rows: unknown[]) {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  } as unknown as import('pg').Pool
}

const labelRow = {
  id: 'lbl-1',
  label_key: 'all_dead',
  label: '全线路失效',
  applies_to: 'reject',
  display_order: 1,
  is_active: true,
  created_at: '2026-05-01T00:00:00Z',
}

describe('listActiveReviewLabels', () => {
  it('返回所有活跃标签', async () => {
    const db = makeDb([labelRow])
    const result = await listActiveReviewLabels(db)
    expect(result).toHaveLength(1)
    expect(result[0]!.label_key).toBe('all_dead')
    const call = db.query as ReturnType<typeof vi.fn>
    expect(call.mock.calls[0][0]).toContain('is_active = true')
  })

  it('按 appliesTo 筛选时 SQL 带参数', async () => {
    const db = makeDb([labelRow])
    await listActiveReviewLabels(db, 'reject')
    const call = db.query as ReturnType<typeof vi.fn>
    expect(call.mock.calls[0][1]).toContain('reject')
  })
})

describe('findReviewLabelByKey', () => {
  it('找到标签 → 返回行', async () => {
    const db = makeDb([labelRow])
    const result = await findReviewLabelByKey(db, 'all_dead')
    expect(result?.label_key).toBe('all_dead')
  })

  it('不存在 → 返回 null', async () => {
    const db = makeDb([])
    const result = await findReviewLabelByKey(db, 'nonexistent')
    expect(result).toBeNull()
  })
})
