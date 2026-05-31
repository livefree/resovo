/**
 * listVideosForBackfillEnrich 单测（META-15-C）
 * 验证三 mode 的 WHERE 构造 + type/limit 参数化 + 软删排除。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listVideosForBackfillEnrich } from '@/api/db/queries/videos'

describe('listVideosForBackfillEnrich (META-15-C)', () => {
  const query = vi.fn()
  const db = { query } as unknown as import('pg').Pool

  beforeEach(() => {
    query.mockReset()
    query.mockResolvedValue({ rows: [] })
  })

  it('mode=never → meta_quality IS NULL + 排除软删', async () => {
    await listVideosForBackfillEnrich(db, { mode: 'never' })
    const [sql] = query.mock.calls[0]
    expect(sql).toContain('v.meta_quality IS NULL')
    expect(sql).toContain('v.deleted_at IS NULL')
    expect(sql).not.toContain("douban_status = 'unmatched'")
  })

  it('mode=unmatched → douban|bangumi unmatched', async () => {
    await listVideosForBackfillEnrich(db, { mode: 'unmatched' })
    const [sql] = query.mock.calls[0]
    expect(sql).toContain("v.douban_status = 'unmatched'")
    expect(sql).toContain("v.bangumi_status = 'unmatched'")
    expect(sql).not.toContain('v.meta_quality IS NULL')
  })

  it('mode=missing-characters → anime 且无 catalog_characters（含已 matched anime）', async () => {
    await listVideosForBackfillEnrich(db, { mode: 'missing-characters' })
    const [sql] = query.mock.calls[0]
    expect(sql).toContain("v.type = 'anime'")
    expect(sql).toContain('NOT EXISTS')
    expect(sql).toContain('catalog_characters cc')
    expect(sql).not.toContain('v.meta_quality IS NULL')
  })

  it('mode=all（默认）→ 四条件并集（含 anime 缺角色，覆盖已 matched anime）', async () => {
    await listVideosForBackfillEnrich(db)
    const [sql] = query.mock.calls[0]
    expect(sql).toContain('v.meta_quality IS NULL OR')
    expect(sql).toContain("v.douban_status = 'unmatched'")
    expect(sql).toContain("v.bangumi_status = 'unmatched'")
    // 关键：all 必须含 anime 缺角色条件（否则漏掉已 matched anime 的角色回填）
    expect(sql).toContain('catalog_characters cc')
    expect(sql).toContain('NOT EXISTS')
  })

  it('type + limit 参数化', async () => {
    await listVideosForBackfillEnrich(db, { mode: 'never', type: 'anime', limit: 50 })
    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain('v.type = $1')
    expect(sql).toContain('LIMIT $2')
    expect(params).toEqual(['anime', 50])
  })

  it('返回行透传', async () => {
    query.mockResolvedValue({ rows: [{ id: 'v1', catalog_id: 'c1', title: 'T', type: 'anime', year: 2007 }] })
    const rows = await listVideosForBackfillEnrich(db, { mode: 'all' })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 'v1', catalog_id: 'c1', type: 'anime' })
  })
})
