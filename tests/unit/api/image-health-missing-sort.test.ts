/**
 * image-health-missing-sort.test.ts — ADR-150 阶段 5 EP-4 follow-up（2026-05-25）
 *
 * 覆盖 `listMissingPosterVideos` SQL ORDER BY 白名单（7 字段）：
 *   - 既有 3 字段：created_at / title / poster_status
 *   - HOTFIX 新增 4 子查询派生字段：poster_source / broken_domain（evt.url）/
 *     occurrence_count / last_seen_broken_at（LATERAL JOIN evt 字段 / 无需 CTE）
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { listMissingPosterVideos } from '@/api/db/queries/imageHealth'

function makePool(): { db: Pool; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  return {
    db: { query } as unknown as Pool,
    query,
  }
}

describe('listMissingPosterVideos sort 白名单（HOTFIX-EP-4 follow-up）', () => {
  it('default sortField=created_at → ORDER BY v.created_at DESC NULLS LAST', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 20, 0, 'created_at', 'desc')
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY v.created_at DESC NULLS LAST')
  })

  it('sortField=title asc → ORDER BY v.title ASC NULLS LAST', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 20, 0, 'title', 'asc')
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY v.title ASC NULLS LAST')
  })

  it('sortField=poster_status desc → ORDER BY mc.poster_status DESC NULLS LAST', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 20, 0, 'poster_status', 'desc')
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY mc.poster_status DESC NULLS LAST')
  })

  // HOTFIX 新 4 字段（LATERAL JOIN evt.* 直接可 ORDER BY / 无需 CTE）
  it('sortField=poster_source asc → ORDER BY mc.poster_source ASC NULLS LAST', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 20, 0, 'poster_source', 'asc')
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY mc.poster_source ASC NULLS LAST')
  })

  it('sortField=broken_domain desc → ORDER BY evt.url DESC NULLS LAST', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 20, 0, 'broken_domain', 'desc')
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY evt.url DESC NULLS LAST')
  })

  it('sortField=occurrence_count desc → ORDER BY evt.occurrence_count DESC NULLS LAST', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 20, 0, 'occurrence_count', 'desc')
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY evt.occurrence_count DESC NULLS LAST')
  })

  it('sortField=last_seen_broken_at asc → ORDER BY evt.last_seen_at ASC NULLS LAST', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 20, 0, 'last_seen_broken_at', 'asc')
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY evt.last_seen_at ASC NULLS LAST')
  })

  it('LATERAL JOIN evt 子查询持续注入（pre-existing 范式）', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 20, 0, 'last_seen_broken_at', 'desc')
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain('LEFT JOIN LATERAL')
    expect(sql).toContain('broken_image_events')
    expect(sql).toContain("image_kind = 'poster'")
  })

  it('LIMIT + OFFSET 始终注入', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 50, 100, 'created_at', 'desc')
    const args = query.mock.calls[0][1] as unknown[]
    expect(args).toEqual([50, 100])
  })
})
