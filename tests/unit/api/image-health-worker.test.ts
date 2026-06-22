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
  listUncheckedImageUrls: vi.fn().mockResolvedValue([]),
  listStaleOkImageUrls: vi.fn().mockResolvedValue([]),
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

  it('HEAD 404 → 单次即置 broken（ADR-213 D-213-5：确定性失败，无内存连败计数器）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    const { checkImageHealth } = await import('@/api/workers/imageHealthWorker')
    await checkImageHealth({
      type: 'health-check', catalogId: 'cat-404', videoId: 'vid-2', kind: 'poster',
      url: 'https://example.com/poster.jpg',
    })
    expect(mockUpsertBrokenImageEvent).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ eventType: 'fetch_404' })
    )
    expect(mockUpdateCatalogImageStatus).toHaveBeenCalledWith(
      expect.anything(), expect.arrayContaining([expect.objectContaining({ status: 'broken' })])
    )
  })

  it('HEAD 5xx → 单次即置 broken（确定性）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))

    const { checkImageHealth } = await import('@/api/workers/imageHealthWorker')
    await checkImageHealth({
      type: 'health-check', catalogId: 'cat-5xx', videoId: 'vid-5xx', kind: 'poster',
      url: 'https://cdn.example.com/p.jpg',
    })
    expect(mockUpsertBrokenImageEvent).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ eventType: 'fetch_5xx' })
    )
    expect(mockUpdateCatalogImageStatus).toHaveBeenCalledWith(
      expect.anything(), expect.arrayContaining([expect.objectContaining({ status: 'broken' })])
    )
  })

  it('HEAD 瞬态（status 0 网络/超时）→ 记 timeout 遥测、不改 status（D-213-5 消 timeout 误报）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 0 }))

    const { checkImageHealth } = await import('@/api/workers/imageHealthWorker')
    await checkImageHealth({
      type: 'health-check', catalogId: 'cat-transient', videoId: 'vid-t', kind: 'poster',
      url: 'https://slow.example.com/p.jpg',
    })
    expect(mockUpsertBrokenImageEvent).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ eventType: 'timeout' })
    )
    // 瞬态不改 status（也不写 checked_at）：updateCatalogImageStatus 不应被调用
    expect(mockUpdateCatalogImageStatus).not.toHaveBeenCalled()
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

  it('HEAD ok 但 GET 5xx → broken（D-213-9：body 取不到=确定性真破损，非 low_quality）', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })   // HEAD
      .mockResolvedValueOnce({ ok: false, status: 502 })  // GET
    )
    const { checkImageHealth } = await import('@/api/workers/imageHealthWorker')
    await checkImageHealth({
      type: 'health-check', catalogId: 'cat-get5xx', videoId: 'vid-g5', kind: 'poster',
      url: 'https://cdn.example.com/g.jpg',
    })
    expect(mockUpsertBrokenImageEvent).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ eventType: 'fetch_5xx' })
    )
    expect(mockUpdateCatalogImageStatus).toHaveBeenCalledWith(
      expect.anything(), expect.arrayContaining([expect.objectContaining({ status: 'broken' })])
    )
  })

  it('HEAD ok 但 GET fetch 抛（瞬态）→ 记 timeout、不改 status', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })   // HEAD
      .mockRejectedValueOnce(new Error('ECONNRESET'))      // GET 网络失败
    )
    const { checkImageHealth } = await import('@/api/workers/imageHealthWorker')
    await checkImageHealth({
      type: 'health-check', catalogId: 'cat-gett', videoId: 'vid-gt', kind: 'poster',
      url: 'https://cdn.example.com/gt.jpg',
    })
    expect(mockUpsertBrokenImageEvent).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ eventType: 'timeout' })
    )
    expect(mockUpdateCatalogImageStatus).not.toHaveBeenCalled()
  })

  it('registerImageHealthWorker 注册 health-check processor', async () => {
    const { registerImageHealthWorker } = await import('@/api/workers/imageHealthWorker')
    registerImageHealthWorker(5)
    expect(mockProcess).toHaveBeenCalledWith('health-check', 5, expect.any(Function))
  })
})

// ── ImageHealthService named job 入队签名 ─────────────────────────

describe('ImageHealthService — named job 入队', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enqueueHealthChecks 使用 named job "health-check"', async () => {
    // 同一 vi.mock 工厂内的 vi.fn() 实例，通过动态 import 拿到再 override
    const mod = await import('@/api/db/queries/imageHealth')
    ;(mod.listPendingImageUrls as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { catalogId: 'cat-1', videoId: 'vid-1', kind: 'poster', url: 'https://cdn.example.com/p.jpg' },
    ])

    const { ImageHealthService } = await import('@/api/services/ImageHealthService')
    const svc = new ImageHealthService({} as import('pg').Pool)
    await svc.enqueueHealthChecks({ add: mockAdd } as unknown as import('@/api/workers/imageHealthWorker').ImageHealthQueue)

    expect(mockAdd).toHaveBeenCalledWith(
      'health-check',
      expect.objectContaining({ type: 'health-check' }),
      expect.anything()
    )
  })

  it('enqueueBlurhashExtract 使用 named job "blurhash-extract"', async () => {
    const mod = await import('@/api/db/queries/imageHealth')
    ;(mod.listMissingBlurhashUrls as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { catalogId: 'cat-2', videoId: 'vid-2', kind: 'backdrop', url: 'https://cdn.example.com/b.jpg' },
    ])

    const { ImageHealthService } = await import('@/api/services/ImageHealthService')
    const svc = new ImageHealthService({} as import('pg').Pool)
    await svc.enqueueBlurhashExtract({ add: mockAdd } as unknown as import('@/api/workers/imageHealthWorker').ImageHealthQueue)

    expect(mockAdd).toHaveBeenCalledWith(
      'blurhash-extract',
      expect.objectContaining({ type: 'blurhash-extract' }),
      expect.anything()
    )
  })

  it('enqueueHealthScanForUnchecked（A-SCAN）扫 unchecked 行入队 health-check（dedup jobId）', async () => {
    const mod = await import('@/api/db/queries/imageHealth')
    ;(mod.listUncheckedImageUrls as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { catalogId: 'cat-u', videoId: 'vid-u', kind: 'poster', url: 'https://cdn.example.com/u.jpg' },
    ]) // 1 行（< pageSize）→ 单页即终止

    const { ImageHealthService } = await import('@/api/services/ImageHealthService')
    const svc = new ImageHealthService({} as import('pg').Pool)
    const res = await svc.enqueueHealthScanForUnchecked(
      { add: mockAdd } as unknown as import('@/api/workers/imageHealthWorker').ImageHealthQueue,
    )

    expect(res.enqueued).toBe(1)
    expect(mockAdd).toHaveBeenCalledWith(
      'health-check',
      expect.objectContaining({ type: 'health-check', catalogId: 'cat-u', kind: 'poster' }),
      expect.objectContaining({ jobId: 'health-check-cat-u-poster' }),
    )
  })

  it('enqueueStaleHealthRecheck（P4-S 周期巡检）stale-ok 行入队 health-check（dedup jobId）', async () => {
    const mod = await import('@/api/db/queries/imageHealth')
    ;(mod.listStaleOkImageUrls as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { catalogId: 'cat-s', videoId: 'vid-s', kind: 'backdrop', url: 'https://cdn.example.com/s.jpg' },
    ]) // 1 行（< pageSize）→ 单页即终止

    const { ImageHealthService } = await import('@/api/services/ImageHealthService')
    const svc = new ImageHealthService({} as import('pg').Pool)
    const res = await svc.enqueueStaleHealthRecheck(
      { add: mockAdd } as unknown as import('@/api/workers/imageHealthWorker').ImageHealthQueue,
    )

    expect(res.enqueued).toBe(1)
    expect(mockAdd).toHaveBeenCalledWith(
      'health-check',
      expect.objectContaining({ type: 'health-check', catalogId: 'cat-s', kind: 'backdrop' }),
      // 周期巡检 jobId 带周期戳（非固定）—— 防 Bull 保留已完成 job 静默跳过后续周期
      expect.objectContaining({ jobId: expect.stringMatching(/^health-check-cat-s-backdrop-\d+$/) }),
    )
  })

  it('enqueueStaleHealthRecheck 连续两周期 jobId 不同（不被上轮保留的已完成 job 静默跳过·Codex stop-gate）', async () => {
    const mod = await import('@/api/db/queries/imageHealth')
    ;(mod.listStaleOkImageUrls as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ catalogId: 'cat-x', videoId: 'v', kind: 'poster', url: 'u' }])
      .mockResolvedValueOnce([{ catalogId: 'cat-x', videoId: 'v', kind: 'poster', url: 'u' }])
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValueOnce(1111).mockReturnValueOnce(2222)

    const { ImageHealthService } = await import('@/api/services/ImageHealthService')
    const svc = new ImageHealthService({} as import('pg').Pool)
    const q = { add: mockAdd } as unknown as import('@/api/workers/imageHealthWorker').ImageHealthQueue
    await svc.enqueueStaleHealthRecheck(q) // 周期 1
    await svc.enqueueStaleHealthRecheck(q) // 周期 2

    const jobId1 = (mockAdd.mock.calls[0][2] as { jobId: string }).jobId
    const jobId2 = (mockAdd.mock.calls[1][2] as { jobId: string }).jobId
    expect(jobId1).toBe('health-check-cat-x-poster-1111')
    expect(jobId2).toBe('health-check-cat-x-poster-2222')
    expect(jobId1).not.toBe(jobId2) // 同行跨周期 jobId 必须不同 → 旧 job 不阻塞新周期
    dateSpy.mockRestore()
  })

  it('enqueueStaleHealthRecheck 无 stale-ok 行（空集）→ enqueued=0、不入队', async () => {
    const mod = await import('@/api/db/queries/imageHealth')
    ;(mod.listStaleOkImageUrls as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])

    const { ImageHealthService } = await import('@/api/services/ImageHealthService')
    const svc = new ImageHealthService({} as import('pg').Pool)
    const res = await svc.enqueueStaleHealthRecheck(
      { add: mockAdd } as unknown as import('@/api/workers/imageHealthWorker').ImageHealthQueue,
    )

    expect(res.enqueued).toBe(0)
    expect(mockAdd).not.toHaveBeenCalled()
  })
})

// ── HEAD 超时 env 配置（IMGH-P4-FIX-HEAD-TIMEOUT）─────────────────
describe('resolveHeadTimeoutMs — HEAD 超时 env 防御解析', () => {
  it('未设 / 空 / 非数 / 0 / 负数 → 默认 5000', async () => {
    const { resolveHeadTimeoutMs } = await import('@/api/workers/imageHealthWorker')
    expect(resolveHeadTimeoutMs(undefined)).toBe(5000)
    expect(resolveHeadTimeoutMs('')).toBe(5000)
    expect(resolveHeadTimeoutMs('abc')).toBe(5000)
    expect(resolveHeadTimeoutMs('0')).toBe(5000)
    expect(resolveHeadTimeoutMs('-100')).toBe(5000)
  })

  it('合法正数 → 透传（CI/dev 可调小）', async () => {
    const { resolveHeadTimeoutMs } = await import('@/api/workers/imageHealthWorker')
    expect(resolveHeadTimeoutMs('300')).toBe(300)
    expect(resolveHeadTimeoutMs('8000')).toBe(8000)
  })
})
