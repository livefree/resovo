/**
 * image-health-scan-queries.test.ts — IMGH-P2-1C scan 查询单测（ADR-209 D-209-2/D-209-3）
 *
 * 覆盖 1C 新增/改动的 imageHealth.scan.ts 查询（route 级测试 mock 了 query → 此处补 SQL 级断言）：
 * - resolveImageEvents：**幂等守卫 `resolved_at IS NULL`**（Codex stop-time review 修正）+ rowCount + 空 ids 短路
 * - getCatalogIdsByVideoIds：DISTINCT + deleted_at 守卫 + 空短路
 * - rescanPostersByCatalogIds：id=ANY scoped + cover_url 非空守卫 + 空短路
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import {
  resolveImageEvents,
  getCatalogIdsByVideoIds,
  rescanPostersByCatalogIds,
  getRecentBrokenSamples,
} from '@/api/db/queries/imageHealth'

function makePool(result: unknown = { rowCount: 0, rows: [] }): { db: Pool; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn().mockResolvedValue(result)
  return { db: { query } as unknown as Pool, query }
}

describe('resolveImageEvents — 幂等守卫（D-209-2）', () => {
  it('SQL 含 resolved_at IS NULL → 已解决事件不重复 UPDATE（真幂等）', async () => {
    const { db, query } = makePool({ rowCount: 2 })
    const n = await resolveImageEvents(db, ['11111111-1111-1111-1111-111111111111'], '已修复')
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain('resolved_at IS NULL')
    expect(sql).toContain('SET resolved_at = NOW()')
    expect(query.mock.calls[0][1]).toEqual(['已修复', ['11111111-1111-1111-1111-111111111111']])
    expect(n).toBe(2)
  })

  it('已解决/不存在事件 → rowCount=0 返回 0（route 据此幂等不报 404）', async () => {
    const { db } = makePool({ rowCount: 0 })
    expect(await resolveImageEvents(db, ['22222222-2222-2222-2222-222222222222'])).toBe(0)
  })

  it('空 ids → 短路返回 0，不发起 query', async () => {
    const { db, query } = makePool()
    expect(await resolveImageEvents(db, [])).toBe(0)
    expect(query).not.toHaveBeenCalled()
  })

  it('note 省略 → 传 null', async () => {
    const { db, query } = makePool({ rowCount: 1 })
    await resolveImageEvents(db, ['33333333-3333-3333-3333-333333333333'])
    expect(query.mock.calls[0][1][0]).toBeNull()
  })
})

describe('getCatalogIdsByVideoIds — 解析守卫（D-209-3）', () => {
  it('SQL DISTINCT catalog_id + catalog_id IS NOT NULL + deleted_at IS NULL', async () => {
    const { db, query } = makePool({ rows: [{ catalog_id: 'c-1' }, { catalog_id: 'c-2' }] })
    const ids = await getCatalogIdsByVideoIds(db, ['v-1'])
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain('SELECT DISTINCT catalog_id')
    expect(sql).toContain('catalog_id IS NOT NULL')
    expect(sql).toContain('deleted_at IS NULL')
    expect(ids).toEqual(['c-1', 'c-2'])
  })

  it('空 videoIds → 短路返回 []，不发起 query', async () => {
    const { db, query } = makePool()
    expect(await getCatalogIdsByVideoIds(db, [])).toEqual([])
    expect(query).not.toHaveBeenCalled()
  })
})

describe('rescanPostersByCatalogIds — scoped 重置守卫（D-209-3）', () => {
  it('SQL id=ANY scoped + cover_url IS NOT NULL（镜像 rescanPosters 守卫）', async () => {
    const { db, query } = makePool({ rowCount: 3 })
    const r = await rescanPostersByCatalogIds(db, ['c-1', 'c-2'])
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain("poster_status = 'pending_review'")
    expect(sql).toContain('id = ANY($1::uuid[])')
    expect(sql).toContain('cover_url IS NOT NULL')
    expect(r).toEqual({ updatedCount: 3 })
  })

  it('空 catalogIds → 短路返回 updatedCount=0，不发起 query', async () => {
    const { db, query } = makePool()
    expect(await rescanPostersByCatalogIds(db, [])).toEqual({ updatedCount: 0 })
    expect(query).not.toHaveBeenCalled()
  })
})

describe('getRecentBrokenSamples — 破损样本区数据源（ADR-210 D-210）', () => {
  it('SQL 事件流口径：DISTINCT ON video_id + 未解决 + poster + JOIN 守卫 + 域名派生 + LIMIT', async () => {
    const { db, query } = makePool({ rows: [] })
    await getRecentBrokenSamples(db, 24)
    const sql = query.mock.calls[0][0] as string
    // D-210-3：每视频取最近一条事件
    expect(sql).toContain('DISTINCT ON (e.video_id)')
    expect(sql).toContain('ORDER BY e.video_id, e.last_seen_at DESC')
    // D-210-1：事件流口径（未解决）
    expect(sql).toContain('e.resolved_at IS NULL')
    // D-210-2：限定海报位
    expect(sql).toContain("e.image_kind = 'poster'")
    // D-210-6：仅真·加载失败 event_type 白名单（排除 timeout 误报 + dimension/aspect 非加载类）
    expect(sql).toContain('e.event_type = ANY($2::text[])')
    // JOIN 守卫：已删视频滤除
    expect(sql).toContain('v.deleted_at IS NULL')
    // D-210-4：broken_domain SQL 派生，统一 getTopBrokenDomains 口径
    expect(sql).toContain('regexp_replace(sub.url')
    // 外层按最新破损排序 + 上限
    expect(sql).toContain('ORDER BY sub.last_seen_at DESC')
    expect(sql).toContain('LIMIT $1')
    // $1=limit / $2=真·加载失败 event_type 白名单（不含 timeout/dimension_too_small/aspect_mismatch）
    const params = query.mock.calls[0][1] as [number, string[]]
    expect(params[0]).toBe(24)
    expect(params[1]).toEqual(['client_load_error', 'empty_src', 'fetch_404', 'fetch_5xx', 'decode_fail'])
    expect(params[1]).not.toContain('timeout')
    expect(params[1]).not.toContain('dimension_too_small')
    expect(params[1]).not.toContain('aspect_mismatch')
  })

  it('limit 透传（默认 24 / 自定义 50），event_type 白名单恒定', async () => {
    const { db, query } = makePool({ rows: [] })
    await getRecentBrokenSamples(db)
    expect((query.mock.calls[0][1] as unknown[])[0]).toBe(24)
    await getRecentBrokenSamples(db, 50)
    expect((query.mock.calls[1][1] as unknown[])[0]).toBe(50)
    // 白名单不随 limit 变
    expect((query.mock.calls[1][1] as unknown[])[1]).toEqual(['client_load_error', 'empty_src', 'fetch_404', 'fetch_5xx', 'decode_fail'])
  })

  it('行映射：DB snake_case → DTO camelCase（posterUrl=e.url / occurrence_count 缺省 0）', async () => {
    const { db } = makePool({
      rows: [
        {
          video_id: 'v-1',
          catalog_id: 'c-1',
          title: '测试影片',
          url: 'https://cdn.example.com/poster.jpg',
          poster_source: 'tmdb',
          poster_status: 'pending_review',
          event_type: 'fetch_404',
          broken_domain: 'cdn.example.com',
          occurrence_count: 7,
          last_seen_broken_at: '2026-06-20T00:00:00.000Z',
        },
        { video_id: 'v-2', catalog_id: 'c-2', title: '无次数', url: 'https://x.io/a.png',
          poster_source: null, poster_status: 'low_quality', event_type: null,
          broken_domain: 'x.io', occurrence_count: null, last_seen_broken_at: null },
      ],
    })
    const rows = await getRecentBrokenSamples(db, 24)
    expect(rows[0]).toEqual({
      videoId: 'v-1',
      catalogId: 'c-1',
      title: '测试影片',
      posterUrl: 'https://cdn.example.com/poster.jpg',
      posterSource: 'tmdb',
      posterStatus: 'pending_review',
      eventType: 'fetch_404',
      brokenDomain: 'cdn.example.com',
      occurrenceCount: 7,
      lastSeenBrokenAt: '2026-06-20T00:00:00.000Z',
    })
    // occurrence_count null → 0（防御）
    expect(rows[1].occurrenceCount).toBe(0)
    expect(rows[1].posterSource).toBeNull()
  })
})
