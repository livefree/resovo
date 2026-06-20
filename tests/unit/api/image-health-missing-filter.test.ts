/**
 * image-health-missing-filter.test.ts — IMGH-P2-1D / ADR-209 D-209-1 + D-209-4
 *
 * 覆盖 listMissingPosterVideos + countMissingPosterVideos 的服务端筛选 + 行级数据契约：
 * - 默认（无 filters）：base WHERE + CTE 分页后候选聚合（metadata_field_proposals + bool_or(is_winner)）
 * - 筛选谓词：search（title ILIKE + short_id exact）/ posterStatus / posterSource / eventType / brokenDomain（SQL 派生）
 * - LATERAL 不变量（MEDIUM-1）：evt 谓词（eventType/brokenDomain）置 LATERAL 之外（外层 WHERE）
 * - total 一致（§17.3.2）：page 与 count 共用同一 filter 谓词 + 参数
 * - 行级契约（D-209-4）：catalogId / eventType / candidateCount / hasHighConfidenceCandidate 映射
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import {
  listMissingPosterVideos,
  countMissingPosterVideos,
} from '@/api/db/queries/imageHealth'

function makePool(rows: unknown[] = []): { db: Pool; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn().mockResolvedValue({ rows })
  return { db: { query } as unknown as Pool, query }
}

describe('listMissingPosterVideos — D-209-1 筛选 + CTE 候选聚合', () => {
  it('无 filters → base WHERE + CTE 分页 + 候选 LATERAL 聚合（params 仅 limit/offset）', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 20, 0, 'created_at', 'desc')
    const sql = query.mock.calls[0][0] as string
    const params = query.mock.calls[0][1] as unknown[]
    expect(sql).toContain('WITH page AS')
    expect(sql).toContain("mc.poster_status IN ('missing','broken','pending_review')")
    // 候选聚合在分页后 page CTE 上 LATERAL（避全量 N+1）
    expect(sql).toContain('FROM metadata_field_proposals')
    expect(sql).toContain('bool_or(is_winner)')
    expect(sql).toContain("field_name IN ('coverUrl','backdropUrl','logoUrl')")
    expect(sql).toContain('catalog_id = page.catalog_id')
    expect(params).toEqual([20, 0])
  })

  it('search → (v.title ILIKE $3 OR v.short_id = $4) + params %x%/x（含 short_id 口径）', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 20, 0, 'created_at', 'desc', { search: 'abc' })
    const sql = query.mock.calls[0][0] as string
    const params = query.mock.calls[0][1] as unknown[]
    expect(sql).toContain('v.title ILIKE $3 OR v.short_id = $4')
    expect(params).toEqual([20, 0, '%abc%', 'abc'])
  })

  it('posterStatus + posterSource → mc 谓词参数化', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 20, 0, 'created_at', 'desc', {
      posterStatus: 'broken', posterSource: 'tmdb',
    })
    const sql = query.mock.calls[0][0] as string
    const params = query.mock.calls[0][1] as unknown[]
    expect(sql).toContain('mc.poster_status = $3')
    expect(sql).toContain('mc.poster_source = $4')
    expect(params).toEqual([20, 0, 'broken', 'tmdb'])
  })

  it('eventType 谓词置 LATERAL 之外（外层 WHERE，LEFT JOIN 等价 INNER — MEDIUM-1 不变量）', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 20, 0, 'created_at', 'desc', { eventType: 'fetch_404' })
    const sql = query.mock.calls[0][0] as string
    const params = query.mock.calls[0][1] as unknown[]
    expect(sql).toContain('evt.event_type = $3')
    // 谓词须在 `) evt ON TRUE`（LATERAL 结束）之后出现，而非 LATERAL 子查询内
    const lateralEnd = sql.indexOf(') evt ON TRUE')
    const predicateAt = sql.indexOf('evt.event_type = $3')
    expect(lateralEnd).toBeGreaterThan(-1)
    expect(predicateAt).toBeGreaterThan(lateralEnd)
    expect(params).toEqual([20, 0, 'fetch_404'])
  })

  it('brokenDomain → SQL regexp_replace 派生口径（对齐 getTopBrokenDomains）', async () => {
    const { db, query } = makePool()
    await listMissingPosterVideos(db, 20, 0, 'created_at', 'desc', { brokenDomain: 'cdn.example.com' })
    const sql = query.mock.calls[0][0] as string
    const params = query.mock.calls[0][1] as unknown[]
    expect(sql).toContain("regexp_replace(evt.url, '^https?://([^/]+).*', '\\1') = $3")
    expect(params).toEqual([20, 0, 'cdn.example.com'])
  })

  it('行级契约映射（D-209-4）：catalogId / eventType / candidateCount / hasHighConfidenceCandidate', async () => {
    const { db } = makePool([{
      id: 'v-1', catalog_id: 'c-1', title: 'T', poster_status: 'broken',
      cover_url: 'https://x/a.jpg', poster_source: 'tmdb',
      last_seen_broken_at: '2026-06-20T00:00:00Z',
      broken_domain: 'cdn.example.com', occurrence_count: '4',
      event_type: 'fetch_404', candidate_count: 2, has_high_confidence: true,
    }])
    const rows = await listMissingPosterVideos(db, 20, 0)
    expect(rows[0]).toEqual({
      videoId: 'v-1', catalogId: 'c-1', title: 'T', posterStatus: 'broken',
      posterUrl: 'https://x/a.jpg', posterSource: 'tmdb',
      lastSeenBrokenAt: '2026-06-20T00:00:00Z', brokenDomain: 'cdn.example.com',
      occurrenceCount: 4, eventType: 'fetch_404',
      candidateCount: 2, hasHighConfidenceCandidate: true,
    })
  })
})

describe('countMissingPosterVideos — D-209-1 total 一致', () => {
  it('无 filters → COUNT + 同 FROM/LATERAL + base WHERE（params 空）', async () => {
    const { db, query } = makePool([{ total: '7' }])
    const total = await countMissingPosterVideos(db)
    const sql = query.mock.calls[0][0] as string
    const params = query.mock.calls[0][1] as unknown[]
    expect(sql).toContain('COUNT(v.id)::int AS total')
    expect(sql).toContain('LEFT JOIN LATERAL')  // 与 page 共用 FROM+LATERAL
    expect(sql).toContain("mc.poster_status IN ('missing','broken','pending_review')")
    expect(params).toEqual([])
    expect(total).toBe(7)
  })

  it('与 page 共用同一筛选谓词（total 与筛选一致；count filter 从 $1 起）', async () => {
    const { db: pageDb, query: pageQuery } = makePool()
    const { db: countDb, query: countQuery } = makePool([{ total: '3' }])
    const filters = { search: 'x', eventType: 'timeout' as const }
    await listMissingPosterVideos(pageDb, 20, 0, 'created_at', 'desc', filters)
    await countMissingPosterVideos(countDb, filters)
    const pageSql = pageQuery.mock.calls[0][0] as string
    const countSql = countQuery.mock.calls[0][0] as string
    // page filter 从 $3、count 从 $1（偏移差因 limit/offset），但谓词集一致
    expect(pageSql).toContain('v.title ILIKE $3 OR v.short_id = $4')
    expect(pageSql).toContain('evt.event_type = $5')
    expect(countSql).toContain('v.title ILIKE $1 OR v.short_id = $2')
    expect(countSql).toContain('evt.event_type = $3')
    expect(countQuery.mock.calls[0][1]).toEqual(['%x%', 'x', 'timeout'])
  })
})
