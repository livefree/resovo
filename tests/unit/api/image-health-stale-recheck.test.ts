/**
 * image-health-stale-recheck.test.ts — listStaleOkImageUrls 的 stale-ok 谓词 SQL
 * （ADR-213 D-213-9①：P4-S 周期巡检读 status='ok' 且 checked_at 陈旧/NULL 行，重入 health-check）
 *
 * 真函数 + mock db.query，断言谓词与 D-213-7 `unknown` 分支同源 + staleDays 参数化。
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { listStaleOkImageUrls } from '@/api/db/queries/imageHealth'

function mockDb(rows: unknown[] = []): { db: Pool; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn().mockResolvedValue({ rows })
  return { db: { query } as unknown as Pool, query }
}

describe('listStaleOkImageUrls — stale-ok 谓词 SQL（ADR-213 D-213-9①）', () => {
  it('谓词与 D-213-7 unknown 分支同源：status=ok ∧ COALESCE(checked_at,-infinity) < NOW()-staleDays', async () => {
    const { db, query } = mockDb()
    await listStaleOkImageUrls(db, 30, 500, 0)
    const [sql, params] = query.mock.calls[0]
    // 4 kind 各自 status='ok' 过滤
    expect(sql).toContain("mc.poster_status = 'ok'")
    expect(sql).toContain("mc.backdrop_status = 'ok'")
    expect(sql).toContain("mc.logo_status = 'ok'")
    expect(sql).toContain("mc.banner_backdrop_status = 'ok'")
    // checked_at 陈旧/NULL（COALESCE -infinity）判定，staleDays 经 make_interval 参数化
    expect(sql).toContain("COALESCE(mc.poster_checked_at, '-infinity'::timestamptz)")
    expect(sql).toContain('make_interval(days => $1)')
    // poster URL 列历史名 cover_url + 软删除排除
    expect(sql).toContain('mc.cover_url IS NOT NULL')
    expect(sql).toContain('v.deleted_at IS NULL')
    // 参数化：staleDays / limit / offset
    expect(params).toEqual([30, 500, 0])
  })

  it('staleDays / limit / offset 透传参数化（不裸插值）', async () => {
    const { db, query } = mockDb()
    await listStaleOkImageUrls(db, 14, 100, 200)
    expect(query.mock.calls[0][1]).toEqual([14, 100, 200])
  })

  it('映射 DB 行 → PendingImageRow（catalogId/videoId/kind/url）', async () => {
    const { db } = mockDb([
      { catalog_id: 'c1', video_id: 'v1', kind: 'poster', url: 'https://cdn.example.com/p.jpg' },
    ])
    const rows = await listStaleOkImageUrls(db, 30)
    expect(rows).toEqual([
      { catalogId: 'c1', videoId: 'v1', kind: 'poster', url: 'https://cdn.example.com/p.jpg' },
    ])
  })
})
