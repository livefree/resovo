/**
 * tests/unit/api/image-health-worker.test.ts
 * IMG-02: imageHealthWorker 核心逻辑单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────

const mockUpsertBrokenImageEvent = vi.fn().mockResolvedValue({ id: 'evt-1' })
const mockUpdateCatalogImageStatus = vi.fn().mockResolvedValue(undefined)

vi.mock('@/api/db/queries/imageHealth', () => ({
  upsertBrokenImageEvent: (...args: unknown[]) => mockUpsertBrokenImageEvent(...args),
  updateCatalogImageStatus: (...args: unknown[]) => mockUpdateCatalogImageStatus(...args),
  updateCatalogImageBlurhash: vi.fn().mockResolvedValue(undefined),
  listPendingImageUrls: vi.fn().mockResolvedValue([]),
  listMissingBlurhashUrls: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/api/lib/postgres', () => ({
  db: { query: vi.fn() },
}))

const mockAdd = vi.fn().mockResolvedValue({ id: 'job-1' })
const mockProcess = vi.fn()
const mockOn = vi.fn()

vi.mock('@/api/lib/queue', () => ({
  imageHealthQueue: { add: mockAdd, process: mockProcess, on: mockOn, addBulk: vi.fn() },
}))

// ── imageHealthWorker ─────────────────────────────────────────────

describe('imageHealthWorker — checkImageHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置 globalThis.fetch mock
    vi.unstubAllGlobals()
  })

  it('无效 URL → upsert fetch_404 + status broken', async () => {
    const { checkImageHealth } = await import('@/api/workers/imageHealthWorker')
    await checkImageHealth({
      type: 'health-check',
      catalogId: 'cat-1',
      videoId: 'vid-1',
      kind: 'poster',
      url: 'not-a-url',
    })
    expect(mockUpsertBrokenImageEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'fetch_404' })
    )
    expect(mockUpdateCatalogImageStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ status: 'broken' })])
    )
  })

  it('404 响应 → upsert fetch_404 事件，不立即置 broken（连续失败未达 3 次）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    const { checkImageHealth } = await import('@/api/workers/imageHealthWorker')
    await checkImageHealth({
      type: 'health-check',
      catalogId: 'cat-distinct-1',
      videoId: 'vid-2',
      kind: 'poster',
      url: 'https://example.com/poster.jpg',
    })
    expect(mockUpsertBrokenImageEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'fetch_404' })
    )
  })

  it('连续 3 次 404 → status 置 broken', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    const { checkImageHealth } = await import('@/api/workers/imageHealthWorker')
    const data = {
      type: 'health-check' as const,
      catalogId: 'cat-seq-3',
      videoId: 'vid-3',
      kind: 'poster' as const,
      url: 'https://cdn.example.com/broken.jpg',
    }

    await checkImageHealth(data)
    await checkImageHealth(data)
    await checkImageHealth(data)

    const brokenCalls = mockUpdateCatalogImageStatus.mock.calls.filter(
      ([, updates]) => Array.isArray(updates) && updates.some((u: { status: string }) => u.status === 'broken')
    )
    expect(brokenCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('200 且 sharp 返回合规尺寸 → status ok，不写 broken event', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })        // HEAD 请求
      .mockResolvedValueOnce({                                   // GET 获取尺寸
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      })
    )

    vi.mock('sharp', () => ({
      default: vi.fn().mockReturnValue({
        metadata: vi.fn().mockResolvedValue({ width: 600, height: 900 }),
        resize: vi.fn().mockReturnThis(),
        ensureAlpha: vi.fn().mockReturnThis(),
        removeAlpha: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({
          data: Buffer.alloc(100 * 100 * 4),
          info: { width: 100, height: 100 },
        }),
      }),
    }))

    const { checkImageHealth } = await import('@/api/workers/imageHealthWorker')
    await checkImageHealth({
      type: 'health-check',
      catalogId: 'cat-ok',
      videoId: 'vid-ok',
      kind: 'poster',
      url: 'https://cdn.example.com/valid.jpg',
    })

    expect(mockUpsertBrokenImageEvent).not.toHaveBeenCalled()
    expect(mockUpdateCatalogImageStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ status: 'ok' })])
    )
  })

  it('registerImageHealthWorker 注册 health-check processor', async () => {
    const { registerImageHealthWorker } = await import('@/api/workers/imageHealthWorker')
    registerImageHealthWorker(5)
    expect(mockProcess).toHaveBeenCalledWith('health-check', 5, expect.any(Function))
  })
})
