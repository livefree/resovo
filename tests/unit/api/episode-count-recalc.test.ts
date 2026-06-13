/**
 * episode-count-recalc.test.ts — FIX-MERGE-EPCOUNT
 *
 * 回归：recalcEpisodeCountFromSources 的 SQL 口径必须与 migration 024 /
 * videos.crawler.ts bumpEpisodeCountIfHigher 完全一致——
 *   - 活跃（deleted_at IS NULL）非投稿（submitted_by IS NULL）源
 *   - MAX(COALESCE(episode_number, 1)) 高水位
 *   - GREATEST 单向递增（只增不减）
 * 防止合并/拆分后 target episode_count 落后实际源集数导致选集丢集。
 */

import { describe, it, expect, vi } from 'vitest'
import type { PoolClient } from 'pg'
import { recalcEpisodeCountFromSources } from '@/api/db/queries/video-merge-mutations'

describe('recalcEpisodeCountFromSources — FIX-MERGE-EPCOUNT', () => {
  it('空 videoIds 短路：不发起任何查询', async () => {
    const queryMock = vi.fn()
    const client = { query: queryMock } as unknown as PoolClient

    await recalcEpisodeCountFromSources(client, [])

    expect(queryMock).not.toHaveBeenCalled()
  })

  it('SQL 口径与 024 一致：活跃非投稿源 MAX(COALESCE(episode_number,1)) + GREATEST 只增不减', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] })
    const client = { query: queryMock } as unknown as PoolClient

    await recalcEpisodeCountFromSources(client, ['v-1', 'v-2'])

    expect(queryMock).toHaveBeenCalledTimes(1)
    const sql = queryMock.mock.calls[0]![0] as string
    // 高水位口径
    expect(sql).toContain('MAX(COALESCE(s.episode_number, 1))')
    expect(sql).toContain('GREATEST(v.episode_count, sm.max_episode)')
    // 与 024 同过滤：活跃 + 非投稿
    expect(sql).toContain('s.deleted_at IS NULL')
    expect(sql).toContain('s.submitted_by IS NULL')
    // 只增不减守卫
    expect(sql).toContain('sm.max_episode > v.episode_count')
    // 不误碰已软删 target
    expect(sql).toContain('v.deleted_at IS NULL')

    const params = queryMock.mock.calls[0]![1] as unknown[]
    expect(params).toEqual([['v-1', 'v-2']])
  })
})
