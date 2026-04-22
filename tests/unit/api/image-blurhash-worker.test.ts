/**
 * tests/unit/api/image-blurhash-worker.test.ts
 * IMG-02: imageBlurhashWorker 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 顶层 vi.mock（Vitest 会提升到所有 import 之前，覆盖动态 import）──────

const mockUpdateCatalogImageBlurhash = vi.fn().mockResolvedValue(undefined)

vi.mock('@/api/db/queries/imageHealth', () => ({
  updateCatalogImageBlurhash: (...args: unknown[]) => mockUpdateCatalogImageBlurhash(...args),
  upsertBrokenImageEvent: vi.fn(),
  updateCatalogImageStatus: vi.fn(),
  listPendingImageUrls: vi.fn().mockResolvedValue([]),
  listMissingBlurhashUrls: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/api/lib/postgres', () => ({
  db: { query: vi.fn() },
}))

vi.mock('@/api/lib/queue', () => ({
  imageHealthQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn(), addBulk: vi.fn() },
}))

// ── sharp mock：toBuffer 可在各测试中按需重载 ─────────────────────

const mockToBuffer = vi.fn()

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    ensureAlpha: vi.fn().mockReturnThis(),
    removeAlpha: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    toBuffer: mockToBuffer,
  })),
}))

// ── blurhash mock ─────────────────────────────────────────────────

vi.mock('blurhash', () => ({
  encode: vi.fn().mockReturnValue('LEHV6nWB2yk8pyo0adR*.7kCMdnj'),
}))

// ── imageBlurhashWorker ───────────────────────────────────────────

describe('imageBlurhashWorker — extractBlurhashAndColor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('下载失败 → 静默返回，不调用 DB', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    const { extractBlurhashAndColor } = await import('@/api/workers/imageBlurhashWorker')
    await extractBlurhashAndColor({
      type: 'blurhash-extract',
      catalogId: 'cat-1',
      videoId: 'vid-1',
      kind: 'poster',
      url: 'https://cdn.example.com/broken.jpg',
    })

    expect(mockUpdateCatalogImageBlurhash).not.toHaveBeenCalled()
  })

  it('fetch 抛异常 → 静默返回，不抛到外层', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    const { extractBlurhashAndColor } = await import('@/api/workers/imageBlurhashWorker')
    await expect(
      extractBlurhashAndColor({
        type: 'blurhash-extract',
        catalogId: 'cat-2',
        videoId: 'vid-2',
        kind: 'poster',
        url: 'https://cdn.example.com/err.jpg',
      })
    ).resolves.toBeUndefined()
  })

  it('不支持的图片种类（logo）→ 不调用 DB', async () => {
    const { extractBlurhashAndColor } = await import('@/api/workers/imageBlurhashWorker')
    await extractBlurhashAndColor({
      type: 'blurhash-extract',
      catalogId: 'cat-3',
      videoId: 'vid-3',
      kind: 'logo',
      url: 'https://cdn.example.com/logo.png',
    })
    expect(mockUpdateCatalogImageBlurhash).not.toHaveBeenCalled()
  })
})

// ── OKLCH 阈值纯函数测试（不依赖 sharp mock 顺序）──────────────────

describe('imageBlurhashWorker — oklchLuminance 阈值', () => {
  it('黑色 RGB(0,0,0) → L ≈ 0，< 15 阈值', async () => {
    const { oklchLuminance } = await import('@/api/workers/imageBlurhashWorker')
    expect(oklchLuminance(0, 0, 0)).toBeCloseTo(0, 1)
    expect(oklchLuminance(0, 0, 0)).toBeLessThan(15)
  })

  it('白色 RGB(255,255,255) → L ≈ 100，> 90 阈值', async () => {
    const { oklchLuminance } = await import('@/api/workers/imageBlurhashWorker')
    expect(oklchLuminance(255, 255, 255)).toBeCloseTo(100, 1)
    expect(oklchLuminance(255, 255, 255)).toBeGreaterThan(90)
  })

  it('纯红 RGB(255,0,0) → L ≈ 59.6，在 [15,90] 范围内（不应被过滤）', async () => {
    const { oklchLuminance } = await import('@/api/workers/imageBlurhashWorker')
    const L = oklchLuminance(255, 0, 0)
    expect(L).toBeGreaterThanOrEqual(15)
    expect(L).toBeLessThanOrEqual(90)
  })

  it('深灰 RGB(10,10,10) → L < 15，应被过滤', async () => {
    const { oklchLuminance } = await import('@/api/workers/imageBlurhashWorker')
    expect(oklchLuminance(10, 10, 10)).toBeLessThan(15)
  })

  it('浅灰 RGB(245,245,245) → L > 90，应被过滤', async () => {
    const { oklchLuminance } = await import('@/api/workers/imageBlurhashWorker')
    expect(oklchLuminance(245, 245, 245)).toBeGreaterThan(90)
  })
})

// ── OKLCH 集成：极暗/极亮图片写入 primaryColor: null ────────────────

describe('imageBlurhashWorker — OKLCH 过滤集成', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  function setupFetchAndToBuffer(colorBuf: Buffer) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(colorBuf.buffer),
    }))
    // 两次 toBuffer 调用（computeBlurhash + extractPrimaryColor）均返回相同数据，
    // 避免 Promise.all 下消费顺序不确定导致颜色数据被错误分配。
    // blurhash.encode 已被 mock，对像素数据没有要求；
    // extractPrimaryColor 只关心颜色，拿到 colorBuf 即可正确过滤。
    mockToBuffer.mockResolvedValue({ data: colorBuf, info: { width: 50, height: 50 } })
  }

  it('极暗图片（全黑）→ primaryColor: null 写入 DB', async () => {
    const blackBuf = Buffer.alloc(50 * 50 * 3, 0)
    setupFetchAndToBuffer(blackBuf)

    const { extractBlurhashAndColor } = await import('@/api/workers/imageBlurhashWorker')
    await extractBlurhashAndColor({
      type: 'blurhash-extract',
      catalogId: 'cat-dark',
      videoId: 'vid-dark',
      kind: 'poster',
      url: 'https://cdn.example.com/dark.jpg',
    })

    expect(mockUpdateCatalogImageBlurhash).toHaveBeenCalledOnce()
    const callArg = mockUpdateCatalogImageBlurhash.mock.calls[0][1] as { primaryColor: string | null }
    expect(callArg.primaryColor).toBeNull()
  })

  it('极亮图片（全白）→ primaryColor: null 写入 DB', async () => {
    const whiteBuf = Buffer.alloc(50 * 50 * 3, 255)
    setupFetchAndToBuffer(whiteBuf)

    const { extractBlurhashAndColor } = await import('@/api/workers/imageBlurhashWorker')
    await extractBlurhashAndColor({
      type: 'blurhash-extract',
      catalogId: 'cat-white',
      videoId: 'vid-white',
      kind: 'poster',
      url: 'https://cdn.example.com/white.jpg',
    })

    expect(mockUpdateCatalogImageBlurhash).toHaveBeenCalledOnce()
    const callArg = mockUpdateCatalogImageBlurhash.mock.calls[0][1] as { primaryColor: string | null }
    expect(callArg.primaryColor).toBeNull()
  })
})
