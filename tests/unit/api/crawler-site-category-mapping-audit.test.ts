/**
 * crawler-site-category-mapping-audit.test.ts — CHG-SN-7-REDO-01-F / ADR-123
 *
 * 覆盖（R-MID-1 系统化第 14 次 / 7 文件 RETRO 框架第 5 文件）：
 *   - listMappingsBySiteKey query 基本路径 + ORDER BY
 *   - siteKeyExists 守卫
 *   - service listMappingsBySiteKey NOT_FOUND 404
 *   - service replaceMappingsBySiteKey 事务全量替换 + before/after audit
 *   - audit payload 内容断言（actionType / targetKind / targetId / before/after mappings）
 *   - zod PutCategoryMappingSchema sourceLabel 重复 refine 拦截
 *   - zod target_genre 22 值之外拒绝
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import { listMappingsBySiteKey, siteKeyExists } from '@/api/db/queries/crawlerSiteCategoryMaps'
import {
  CrawlerSiteCategoryMapService,
  PutCategoryMappingSchema,
} from '@/api/services/CrawlerSiteCategoryMapService'

type QueryArgs = { sql: string; params?: readonly unknown[] }
function makePool(queryImpl: (args: QueryArgs) => { rows: Record<string, unknown>[] }): Pool {
  const client: PoolClient = {
    query: vi.fn((sql: string, params?: readonly unknown[]) =>
      Promise.resolve(queryImpl({ sql, params })),
    ),
    release: vi.fn(),
  } as unknown as PoolClient
  return {
    query: vi.fn((sql: string, params?: readonly unknown[]) =>
      Promise.resolve(queryImpl({ sql, params })),
    ),
    connect: vi.fn(() => Promise.resolve(client)),
  } as unknown as Pool
}

function spyAuditOnService(svc: CrawlerSiteCategoryMapService): ReturnType<typeof vi.fn> {
  const writeMock = vi.fn()
  ;(svc as unknown as { auditSvc: { write: typeof writeMock } }).auditSvc = { write: writeMock }
  return writeMock
}

describe('crawlerSiteCategoryMaps query 层', () => {
  beforeEach(() => vi.clearAllMocks())

  it('1. listMappingsBySiteKey 返回行按 source_label ASC 排序', async () => {
    const rows = [
      { site_key: 's', source_label: '动作', target_genre: 'action', created_at: 't1', updated_at: 't2' },
      { site_key: 's', source_label: '喜剧', target_genre: 'comedy', created_at: 't1', updated_at: 't2' },
    ]
    const pool = makePool(() => ({ rows }))
    const result = await listMappingsBySiteKey(pool, 's')
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ sourceLabel: '动作', targetGenre: 'action' })
    expect(result[1]).toMatchObject({ sourceLabel: '喜剧', targetGenre: 'comedy' })
  })

  it('2. SQL 含 ORDER BY source_label ASC + WHERE site_key = $1', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [] })
    const pool = { query: queryFn } as unknown as Pool
    await listMappingsBySiteKey(pool, 'tested')
    const [sql, params] = queryFn.mock.calls[0]
    expect(params).toEqual(['tested'])
    expect(sql).toContain('ORDER BY source_label ASC')
    expect(sql).toContain('WHERE site_key = $1')
  })

  it('3. siteKeyExists 返回 true / false 来自 EXISTS', async () => {
    const poolTrue = makePool(() => ({ rows: [{ exists: true }] }))
    const poolFalse = makePool(() => ({ rows: [{ exists: false }] }))
    expect(await siteKeyExists(poolTrue, 'k')).toBe(true)
    expect(await siteKeyExists(poolFalse, 'k')).toBe(false)
  })
})

describe('CrawlerSiteCategoryMapService.listMappingsBySiteKey', () => {
  it('4. site 不存在 → NOT_FOUND 404', async () => {
    const pool = makePool((q) => {
      if (q.sql.includes('EXISTS')) return { rows: [{ exists: false }] }
      return { rows: [] }
    })
    const svc = new CrawlerSiteCategoryMapService(pool)
    await expect(svc.listMappingsBySiteKey('missing')).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 })
  })

  it('5. site 存在 + 无映射 → 空数组', async () => {
    const pool = makePool((q) => {
      if (q.sql.includes('EXISTS')) return { rows: [{ exists: true }] }
      return { rows: [] }
    })
    const svc = new CrawlerSiteCategoryMapService(pool)
    const result = await svc.listMappingsBySiteKey('s')
    expect(result).toEqual([])
  })
})

describe('CrawlerSiteCategoryMapService.replaceMappingsBySiteKey audit', () => {
  it('6. site 不存在 → NOT_FOUND 404 / audit 不写', async () => {
    const pool = makePool((q) => {
      if (q.sql.includes('EXISTS')) return { rows: [{ exists: false }] }
      return { rows: [] }
    })
    const svc = new CrawlerSiteCategoryMapService(pool)
    const writeMock = spyAuditOnService(svc)
    await expect(svc.replaceMappingsBySiteKey('missing', [], 'actor')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('7. 完整 audit payload 内容断言：actionType / targetKind / targetId / beforeJsonb / afterJsonb', async () => {
    let insertedCount = 0
    const pool = makePool((q) => {
      if (q.sql.includes('EXISTS')) return { rows: [{ exists: true }] }
      // 第一次 SELECT before 返回 1 行旧映射
      if (q.sql.includes('SELECT site_key') && q.sql.includes('crawler_site_category_maps')) {
        return { rows: [{
          site_key: 'jszyapi', source_label: '旧动作', target_genre: 'action',
          created_at: 't0', updated_at: 't0',
        }] }
      }
      if (q.sql.includes('BEGIN') || q.sql.includes('COMMIT')) return { rows: [] }
      if (q.sql.includes('DELETE FROM crawler_site_category_maps')) return { rows: [] }
      if (q.sql.includes('INSERT INTO crawler_site_category_maps')) {
        insertedCount += 1
        return { rows: [{
          site_key: 'jszyapi',
          source_label: q.params?.[1],
          target_genre: q.params?.[2],
          created_at: 't1',
          updated_at: 't1',
        }] }
      }
      return { rows: [] }
    })
    const svc = new CrawlerSiteCategoryMapService(pool)
    const writeMock = spyAuditOnService(svc)
    const result = await svc.replaceMappingsBySiteKey(
      'jszyapi',
      [
        { sourceLabel: '动作片', targetGenre: 'action' },
        { sourceLabel: '喜剧片', targetGenre: 'comedy' },
      ],
      'actor-1',
      'req-1',
    )
    expect(result.written).toBe(2)
    expect(insertedCount).toBe(2)
    // R-MID-1 audit payload 内容断言（expect.objectContaining 形式 / audit-log-coverage 守卫要求）
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'crawler_site.category_mapping_update',
        targetKind: 'crawler_site',
        targetId: 'jszyapi',
        beforeJsonb: expect.objectContaining({
          mappings: expect.arrayContaining([
            expect.objectContaining({ sourceLabel: '旧动作', targetGenre: 'action' }),
          ]),
        }),
        afterJsonb: expect.objectContaining({
          mappings: expect.arrayContaining([
            expect.objectContaining({ sourceLabel: '动作片', targetGenre: 'action' }),
            expect.objectContaining({ sourceLabel: '喜剧片', targetGenre: 'comedy' }),
          ]),
          written: 2,
        }),
      }),
    )
  })

  it('8. 空 mappings 输入 → DELETE 后 0 INSERT / written=0 / audit 仍写 before/after', async () => {
    const pool = makePool((q) => {
      if (q.sql.includes('EXISTS')) return { rows: [{ exists: true }] }
      if (q.sql.includes('SELECT site_key')) return { rows: [] }
      return { rows: [] }
    })
    const svc = new CrawlerSiteCategoryMapService(pool)
    const writeMock = spyAuditOnService(svc)
    const result = await svc.replaceMappingsBySiteKey('jszyapi', [], 'actor-1')
    expect(result.written).toBe(0)
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'crawler_site.category_mapping_update',
        afterJsonb: expect.objectContaining({ written: 0 }),
      }),
    )
  })
})

describe('PutCategoryMappingSchema zod', () => {
  it('9. sourceLabel 重复 → refine 拒绝', () => {
    const result = PutCategoryMappingSchema.safeParse({
      mappings: [
        { sourceLabel: 'dup', targetGenre: 'action' },
        { sourceLabel: 'dup', targetGenre: 'comedy' },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('不得重复')
    }
  })

  it('10. target_genre 22 值之外拒绝', () => {
    const result = PutCategoryMappingSchema.safeParse({
      mappings: [{ sourceLabel: 'x', targetGenre: 'invalid_genre' }],
    })
    expect(result.success).toBe(false)
  })

  it('11. target_genre _unmapped / _discard 接受', () => {
    const result = PutCategoryMappingSchema.safeParse({
      mappings: [
        { sourceLabel: 'x', targetGenre: '_unmapped' },
        { sourceLabel: 'y', targetGenre: '_discard' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('12. mappings > 500 → 拒绝', () => {
    const mappings = Array.from({ length: 501 }, (_, i) => ({
      sourceLabel: `label-${i}`,
      targetGenre: 'action' as const,
    }))
    const result = PutCategoryMappingSchema.safeParse({ mappings })
    expect(result.success).toBe(false)
  })
})
