import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listActiveHomeModules,
  listAdminHomeModules,
  findHomeModuleById,
  createHomeModule,
  updateHomeModule,
  deleteHomeModule,
  reorderHomeModules,
  listHomeModulesByContentRef,
} from '@/api/db/queries/home-modules'

// ── mock helpers ──────────────────────────────────────────────────────────────

const MODULE_ROW = {
  id: 'a0000000-0000-0000-0000-000000000001',
  slot: 'featured',
  brand_scope: 'all-brands',
  brand_slug: null,
  ordering: 1,
  content_ref_type: 'video',
  content_ref_id: 'vid-shortid-1',
  start_at: null,
  end_at: null,
  enabled: true,
  metadata: {},
  created_at: '2026-04-22T00:00:00Z',
  updated_at: '2026-04-22T00:00:00Z',
}

const mockQuery = vi.fn()
const mockConnect = vi.fn()
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
}
const mockDb = {
  query: mockQuery,
  connect: mockConnect,
} as unknown as import('pg').Pool

beforeEach(() => {
  mockQuery.mockReset()
  mockConnect.mockReset()
  mockClient.query.mockReset()
  mockClient.release.mockReset()
})

// ── listActiveHomeModules ─────────────────────────────────────────────────────

describe('listActiveHomeModules', () => {
  it('返回激活模块并正确映射字段', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [MODULE_ROW] })
    const result = await listActiveHomeModules(mockDb, 'featured', null)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: MODULE_ROW.id,
      slot: 'featured',
      brandScope: 'all-brands',
      brandSlug: null,
      ordering: 1,
      contentRefType: 'video',
      contentRefId: 'vid-shortid-1',
      enabled: true,
    })
  })

  it('无数据时返回空数组', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await listActiveHomeModules(mockDb, 'top10', null)
    expect(result).toEqual([])
  })

  it('brand_scope 查询协议：SQL 包含 all-brands OR brand_slug', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await listActiveHomeModules(mockDb, 'banner', 'alpha')
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain("brand_scope = 'all-brands'")
    expect(sql).toContain('brand_slug')
  })

  it('metadata 为 null 时返回空对象', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...MODULE_ROW, metadata: null }] })
    const result = await listActiveHomeModules(mockDb, 'featured', null)
    expect(result[0].metadata).toEqual({})
  })
})

// ── listAdminHomeModules ──────────────────────────────────────────────────────

describe('listAdminHomeModules', () => {
  it('返回分页数据和 total', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [MODULE_ROW] })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
    const result = await listAdminHomeModules(mockDb, { page: 1, limit: 10 })
    expect(result.rows).toHaveLength(1)
    expect(result.total).toBe(5)
  })

  it('slot 过滤条件写入 SQL', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
    await listAdminHomeModules(mockDb, { slot: 'top10', page: 1, limit: 20 })
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain('slot = ')
  })
})

// ── findHomeModuleById ────────────────────────────────────────────────────────

describe('findHomeModuleById', () => {
  it('找到时返回 HomeModule', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [MODULE_ROW] })
    const result = await findHomeModuleById(mockDb, MODULE_ROW.id)
    expect(result?.id).toBe(MODULE_ROW.id)
  })

  it('不存在时返回 null', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await findHomeModuleById(mockDb, 'nonexistent-id')
    expect(result).toBeNull()
  })
})

// ── createHomeModule ──────────────────────────────────────────────────────────

describe('createHomeModule', () => {
  it('插入并返回 HomeModule', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [MODULE_ROW] })
    const result = await createHomeModule(mockDb, {
      slot: 'featured',
      brandScope: 'all-brands',
      contentRefType: 'video',
      contentRefId: 'vid-shortid-1',
    })
    expect(result.slot).toBe('featured')
    expect(result.contentRefType).toBe('video')
  })

  it('SQL 包含 INSERT INTO home_modules', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [MODULE_ROW] })
    await createHomeModule(mockDb, {
      slot: 'top10',
      brandScope: 'all-brands',
      contentRefType: 'video',
      contentRefId: 'vid-abc',
    })
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql.toLowerCase()).toContain('insert into home_modules')
  })
})

// ── updateHomeModule ──────────────────────────────────────────────────────────

describe('updateHomeModule', () => {
  it('有更新字段时执行 UPDATE', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...MODULE_ROW, enabled: false }] })
    const result = await updateHomeModule(mockDb, MODULE_ROW.id, { enabled: false })
    expect(result?.enabled).toBe(false)
  })

  it('无更新字段时走 findById 路径（SQL 以 SELECT 开头）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [MODULE_ROW] })
    await updateHomeModule(mockDb, MODULE_ROW.id, {})
    const sql: string = mockQuery.mock.calls[0][0].trim()
    expect(sql.toUpperCase()).toMatch(/^SELECT/)
  })
})

// ── deleteHomeModule ──────────────────────────────────────────────────────────

describe('deleteHomeModule', () => {
  it('删除成功返回 true', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 })
    const result = await deleteHomeModule(mockDb, MODULE_ROW.id)
    expect(result).toBe(true)
  })

  it('不存在时返回 false', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 })
    const result = await deleteHomeModule(mockDb, 'nonexistent-id')
    expect(result).toBe(false)
  })
})

// ── reorderHomeModules ────────────────────────────────────────────────────────

describe('reorderHomeModules', () => {
  it('空数组时不连接 DB 直接返回 0', async () => {
    const result = await reorderHomeModules(mockDb, [])
    expect(result).toBe(0)
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('事务内批量更新 ordering', async () => {
    mockConnect.mockResolvedValueOnce(mockClient)
    mockClient.query
      .mockResolvedValueOnce({})               // BEGIN
      .mockResolvedValueOnce({ rowCount: 1 })  // UPDATE id1
      .mockResolvedValueOnce({ rowCount: 1 })  // UPDATE id2
      .mockResolvedValueOnce({})               // COMMIT
    const result = await reorderHomeModules(mockDb, [
      { id: 'id1', ordering: 0 },
      { id: 'id2', ordering: 1 },
    ])
    expect(result).toBe(2)
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('UPDATE 失败时回滚并重抛异常', async () => {
    mockConnect.mockResolvedValueOnce(mockClient)
    const err = new Error('constraint violation')
    mockClient.query
      .mockResolvedValueOnce({})    // BEGIN
      .mockRejectedValueOnce(err)   // UPDATE fails
      .mockResolvedValueOnce({})    // ROLLBACK
    await expect(
      reorderHomeModules(mockDb, [{ id: 'id1', ordering: 0 }])
    ).rejects.toThrow('constraint violation')
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(mockClient.release).toHaveBeenCalled()
  })
})

// ── listHomeModulesByContentRef ───────────────────────────────────────────────

describe('listHomeModulesByContentRef', () => {
  it('按 content_ref 反查返回列表', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [MODULE_ROW] })
    const result = await listHomeModulesByContentRef(mockDb, 'video', 'vid-shortid-1')
    expect(result).toHaveLength(1)
    expect(result[0].contentRefId).toBe('vid-shortid-1')
  })

  it('SQL 包含 content_ref_type 和 content_ref_id 条件', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await listHomeModulesByContentRef(mockDb, 'video_type', 'anime')
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain('content_ref_type')
    expect(sql).toContain('content_ref_id')
  })
})
