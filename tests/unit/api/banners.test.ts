import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listActiveBanners,
  listAllBanners,
  findBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  updateBannerSortOrders,
} from '@/api/db/queries/home-banners'
import { BannerService } from '@/api/services/BannerService'
import { z } from 'zod'

// ── mock helpers ─────────────────────────────────────────────────────────────

const BANNER_ROW = {
  id: 'b1b1b1b1-0000-0000-0000-000000000001',
  title: { 'zh-CN': '春季特辑', en: 'Spring Special' },
  image_url: 'https://cdn.example.com/banner1.jpg',
  link_type: 'video',
  link_target: 'mv-spring-2026',
  sort_order: 1,
  active_from: null,
  active_to: null,
  is_active: true,
  brand_scope: 'all-brands',
  brand_slug: null,
  created_at: '2026-04-21T00:00:00Z',
  updated_at: '2026-04-21T00:00:00Z',
}

const mockQuery = vi.fn()
const mockDb = { query: mockQuery, connect: vi.fn() } as unknown as import('pg').Pool

beforeEach(() => {
  mockQuery.mockReset()
})

// ── listActiveBanners ─────────────────────────────────────────────────────────

describe('listActiveBanners', () => {
  it('返回 is_active banner 并 mapCard', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [BANNER_ROW] })
    const result = await listActiveBanners(mockDb)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: BANNER_ROW.id,
      imageUrl: BANNER_ROW.image_url,
      linkType: 'video',
      sortOrder: 1,
    })
  })

  it('title jsonb 正确透传', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [BANNER_ROW] })
    const result = await listActiveBanners(mockDb)
    expect(result[0].title).toEqual({ 'zh-CN': '春季特辑', en: 'Spring Special' })
  })

  it('无数据时返回空数组', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await listActiveBanners(mockDb)
    expect(result).toEqual([])
  })

  it('有 brandSlug 时追加 brand 条件', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [BANNER_ROW] })
    await listActiveBanners(mockDb, { brandSlug: 'alpha' })
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql).toContain('brand_slug')
  })
})

// ── listAllBanners ────────────────────────────────────────────────────────────

describe('listAllBanners', () => {
  it('返回分页数据和 total', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [BANNER_ROW] })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
    const result = await listAllBanners(mockDb, { page: 1, limit: 20 })
    expect(result.total).toBe(5)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].isActive).toBe(true)
  })
})

// ── findBannerById ────────────────────────────────────────────────────────────

describe('findBannerById', () => {
  it('找到时返回 Banner 对象', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [BANNER_ROW] })
    const result = await findBannerById(mockDb, BANNER_ROW.id)
    expect(result).not.toBeNull()
    expect(result?.id).toBe(BANNER_ROW.id)
  })

  it('未找到时返回 null', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await findBannerById(mockDb, 'nonexistent-id')
    expect(result).toBeNull()
  })
})

// ── createBanner ──────────────────────────────────────────────────────────────

describe('createBanner', () => {
  it('INSERT 并返回新 banner', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [BANNER_ROW] })
    const result = await createBanner(mockDb, {
      title: { 'zh-CN': '春季特辑' },
      imageUrl: 'https://cdn.example.com/banner1.jpg',
      linkType: 'video',
      linkTarget: 'mv-spring-2026',
    })
    expect(result.id).toBe(BANNER_ROW.id)
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql.toUpperCase()).toContain('INSERT')
  })

  it('title 序列化为 JSON 字符串传入 DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [BANNER_ROW] })
    const title = { 'zh-CN': '测试' }
    await createBanner(mockDb, {
      title,
      imageUrl: 'https://cdn.example.com/x.jpg',
      linkType: 'external',
      linkTarget: 'https://example.com',
    })
    const params = mockQuery.mock.calls[0][1] as unknown[]
    expect(params[0]).toBe(JSON.stringify(title))
  })
})

// ── updateBanner ──────────────────────────────────────────────────────────────

describe('updateBanner', () => {
  it('有字段变更时执行 UPDATE', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...BANNER_ROW, is_active: false }] })
    const result = await updateBanner(mockDb, BANNER_ROW.id, { isActive: false })
    expect(result?.isActive).toBe(false)
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql.toUpperCase()).toContain('UPDATE')
  })

  it('无字段变更时直接走 findBannerById', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [BANNER_ROW] })
    await updateBanner(mockDb, BANNER_ROW.id, {})
    const sql: string = mockQuery.mock.calls[0][0]
    expect(sql.toUpperCase()).toContain('SELECT')
  })
})

// ── deleteBanner ──────────────────────────────────────────────────────────────

describe('deleteBanner', () => {
  it('成功删除返回 true', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 })
    expect(await deleteBanner(mockDb, BANNER_ROW.id)).toBe(true)
  })

  it('未找到返回 false', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 })
    expect(await deleteBanner(mockDb, 'nonexistent')).toBe(false)
  })
})

// ── BannerService.listActive — locale 选取 ────────────────────────────────────

describe('BannerService.listActive locale 选取', () => {
  it('指定 locale 时返回对应语言 title', async () => {
    const mockDbLocale = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{
          ...BANNER_ROW,
          title: { 'zh-CN': '春季特辑', en: 'Spring Special' },
        }],
      }),
      connect: vi.fn(),
    } as unknown as import('pg').Pool
    const svc = new BannerService(mockDbLocale)
    const result = await svc.listActive({ locale: 'en' })
    expect(result[0].title).toBe('Spring Special')
  })

  it('locale 不存在时回退到 zh-CN', async () => {
    const mockDbLocale = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{
          ...BANNER_ROW,
          title: { 'zh-CN': '春季特辑', en: 'Spring Special' },
        }],
      }),
      connect: vi.fn(),
    } as unknown as import('pg').Pool
    const svc = new BannerService(mockDbLocale)
    const result = await svc.listActive({ locale: 'ja' })
    expect(result[0].title).toBe('春季特辑')
  })

  it('无 locale 参数时回退到 zh-CN', async () => {
    const mockDbLocale = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{
          ...BANNER_ROW,
          title: { 'zh-CN': '春季特辑', en: 'Spring Special' },
        }],
      }),
      connect: vi.fn(),
    } as unknown as import('pg').Pool
    const svc = new BannerService(mockDbLocale)
    const result = await svc.listActive({})
    expect(result[0].title).toBe('春季特辑')
  })

  it('title 全部 locale 不匹配时取第一个值', async () => {
    const mockDbLocale = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{
          ...BANNER_ROW,
          title: { fr: 'Printemps Spécial' },
        }],
      }),
      connect: vi.fn(),
    } as unknown as import('pg').Pool
    const svc = new BannerService(mockDbLocale)
    const result = await svc.listActive({ locale: 'de' })
    expect(result[0].title).toBe('Printemps Spécial')
  })
})

// ── brandScope/brandSlug Zod 约束（admin 路由层） ─────────────────────────────

describe('brandScope/brandSlug Zod 约束', () => {
  const BannerBrandScopeSchema = z.enum(['brand-specific', 'all-brands'])
  const brandScopeRefinement = (
    data: { brandScope?: string; brandSlug?: string | null },
    ctx: z.RefinementCtx
  ) => {
    if (data.brandScope === 'brand-specific' && !data.brandSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'brandScope 为 brand-specific 时 brandSlug 不得为空',
        path: ['brandSlug'],
      })
    }
    if (data.brandScope === 'all-brands' && data.brandSlug != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'brandScope 为 all-brands 时 brandSlug 必须为 null',
        path: ['brandSlug'],
      })
    }
  }

  const TestSchema = z.object({
    brandScope: BannerBrandScopeSchema.optional(),
    brandSlug: z.string().max(64).nullable().optional(),
  }).superRefine(brandScopeRefinement)

  it('brand-specific + 有效 brandSlug 通过校验', () => {
    expect(TestSchema.safeParse({ brandScope: 'brand-specific', brandSlug: 'alpha' }).success).toBe(true)
  })

  it('brand-specific + brandSlug null 校验失败', () => {
    const result = TestSchema.safeParse({ brandScope: 'brand-specific', brandSlug: null })
    expect(result.success).toBe(false)
  })

  it('all-brands + brandSlug 不为 null 校验失败', () => {
    const result = TestSchema.safeParse({ brandScope: 'all-brands', brandSlug: 'alpha' })
    expect(result.success).toBe(false)
  })

  it('all-brands + brandSlug null 通过校验', () => {
    expect(TestSchema.safeParse({ brandScope: 'all-brands', brandSlug: null }).success).toBe(true)
  })

  it('未设置 brandScope 时不触发约束', () => {
    expect(TestSchema.safeParse({ brandSlug: null }).success).toBe(true)
  })
})

// ── updateBannerSortOrders ────────────────────────────────────────────────────

describe('updateBannerSortOrders', () => {
  it('空数组时不调用 connect', async () => {
    await updateBannerSortOrders(mockDb, [])
    expect(mockDb.connect).not.toHaveBeenCalled()
  })

  it('批量更新时使用事务', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({}),
      release: vi.fn(),
    }
    ;(mockDb.connect as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockClient)

    await updateBannerSortOrders(mockDb, [
      { id: 'id-1', sortOrder: 0 },
      { id: 'id-2', sortOrder: 1 },
    ])

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
    expect(mockClient.release).toHaveBeenCalled()
  })
})
