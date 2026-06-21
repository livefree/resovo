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
