/**
 * tests/unit/api/videos-trending-query.test.ts
 * STATS-05-B（ADR-216 D-216-2 / D-216-9）：listTrendingVideos 改用播放聚合桶真源的 SQL 生成断言。
 *
 * 用 mocked Pool 调真实 listTrendingVideos，验证：
 *   - today  → video_play_hourly 滚动 24h，且显式 bucket_hour ≤ now() 防未来桶（D-216-9）
 *   - week   → video_play_daily 近 7 自然日（bucket_date ≥ current_date − 6）
 *   - month  → video_play_daily 近 30 自然日（bucket_date ≥ current_date − 29）
 *   - 排序：window_plays DESC NULLS LAST, updated_at DESC（稳定 fallback：空窗退化 recency）
 *   - 不再用 updated_at recency 占位过滤（删 `v.updated_at >= NOW() - INTERVAL`）
 *   - 公开可见过滤保留；type 维筛选参数化
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { listTrendingVideos } from '@/api/db/queries/videos'

interface QueryCall {
  text: string
  values?: unknown[]
}

function makePool(): { db: Pool; calls: QueryCall[] } {
  const calls: QueryCall[] = []
  const query = vi.fn((text: string, values?: unknown[]) => {
    calls.push({ text, values })
    return Promise.resolve({ rows: [] })
  })
  return { db: { query } as unknown as Pool, calls }
}

function onlyCall(calls: QueryCall[]): QueryCall {
  if (calls.length !== 1) throw new Error(`expected exactly 1 query, got ${calls.length}`)
  return calls[0]
}

describe('listTrendingVideos — period 窗口聚合桶真源（STATS-05-B / ADR-216 D-216-2）', () => {
  it('today：读 video_play_hourly 滚动 24h + 显式 bucket_hour ≤ now() 防未来桶（D-216-9）', async () => {
    const { db, calls } = makePool()
    await listTrendingVideos(db, { period: 'today', limit: 20 })

    const q = onlyCall(calls)
    expect(q.text).toContain('FROM video_play_hourly')
    expect(q.text).toContain("bucket_hour >= NOW() - INTERVAL '24 hours'")
    // D-216-9：未来桶防护
    expect(q.text).toContain('bucket_hour <= NOW()')
    // 窗口聚合按 video 求和
    expect(q.text).toContain('SUM(play_count) AS window_plays')
    expect(q.text).toContain('GROUP BY video_id')
    // today 不读 daily 表
    expect(q.text).not.toContain('FROM video_play_daily')
  })

  it('week：读 video_play_daily 近 7 自然日（bucket_date ≥ current_date − 6）', async () => {
    const { db, calls } = makePool()
    await listTrendingVideos(db, { period: 'week', limit: 20 })

    const q = onlyCall(calls)
    expect(q.text).toContain('FROM video_play_daily')
    expect(q.text).toContain('bucket_date >= CURRENT_DATE - 6')
    expect(q.text).toContain('bucket_date <= CURRENT_DATE')
    expect(q.text).not.toContain('FROM video_play_hourly')
  })

  it('month：读 video_play_daily 近 30 自然日（bucket_date ≥ current_date − 29）', async () => {
    const { db, calls } = makePool()
    await listTrendingVideos(db, { period: 'month', limit: 20 })

    const q = onlyCall(calls)
    expect(q.text).toContain('FROM video_play_daily')
    expect(q.text).toContain('bucket_date >= CURRENT_DATE - 29')
    expect(q.text).toContain('bucket_date <= CURRENT_DATE')
  })

  it('排序：window_plays DESC NULLS LAST, updated_at DESC（稳定 fallback）', async () => {
    const { db, calls } = makePool()
    await listTrendingVideos(db, { period: 'today', limit: 20 })

    const q = onlyCall(calls)
    expect(q.text).toContain('ORDER BY w.window_plays DESC NULLS LAST, v.updated_at DESC')
  })

  it('不再用 updated_at recency 占位过滤（删 v.updated_at >= NOW() - INTERVAL）', async () => {
    const { db, calls } = makePool()
    await listTrendingVideos(db, { period: 'week', limit: 20 })

    const q = onlyCall(calls)
    expect(q.text).not.toMatch(/v\.updated_at\s*>=\s*NOW\(\)\s*-\s*INTERVAL/)
  })

  it('公开可见过滤保留 + type 维筛选参数化', async () => {
    const { db, calls } = makePool()
    await listTrendingVideos(db, { period: 'month', type: 'anime', limit: 10 })

    const q = onlyCall(calls)
    expect(q.text).toContain('v.is_published = true')
    expect(q.text).toContain('v.deleted_at IS NULL')
    expect(q.text).toContain("v.visibility_status = 'public'")
    expect(q.text).toContain('v.type = $1')
    expect(q.values).toContain('anime')
    // limit 参数化绑定
    expect(q.values).toContain(10)
  })
})
