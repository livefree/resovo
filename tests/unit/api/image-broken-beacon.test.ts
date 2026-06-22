/**
 * tests/unit/api/image-broken-beacon.test.ts
 * IMG-03: POST /v1/internal/image-broken beacon 端点测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// ── Mocks ──────────────────────────────────────────────────────────

const mockUpsertBrokenImageEvent = vi.fn().mockResolvedValue({ id: 'evt-1', occurrenceCount: 1 })
const mockMarkCatalogClientError = vi.fn().mockResolvedValue(1)

vi.mock('@/api/db/queries/imageHealth', () => ({
  upsertBrokenImageEvent: (...args: unknown[]) => mockUpsertBrokenImageEvent(...args),
  markCatalogClientError: (...args: unknown[]) => mockMarkCatalogClientError(...args),
}))

vi.mock('@/api/lib/postgres', () => ({
  db: {},
}))

// ── 测试 fixture ─────────────────────────────────────────────────

async function buildApp() {
  const fastify = Fastify({ logger: false })
  const { internalImageBrokenRoutes } = await import('@/api/routes/internal/image-broken')
  await fastify.register(internalImageBrokenRoutes, { prefix: '/v1' })
  return fastify
}

const VALID_BODY = {
  video_id: '00000000-0000-0000-0000-000000000001',
  image_kind: 'poster',
  url: 'https://cdn.example.com/poster.jpg',
  reason: 'client_load_error',
}

// ── Tests ──────────────────────────────────────────────────────────

describe('POST /v1/internal/image-broken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('合法请求 → 204 + upsert 被调用', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/image-broken',
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(204)
    expect(mockUpsertBrokenImageEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        videoId: VALID_BODY.video_id,
        imageKind: 'poster',
        eventType: 'client_load_error',
      })
    )
  })

  it('重复 POST → upsert 再次调用（occurrence_count 由 DB 层累加）', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/v1/internal/image-broken', payload: VALID_BODY })
    await app.inject({ method: 'POST', url: '/v1/internal/image-broken', payload: VALID_BODY })
    expect(mockUpsertBrokenImageEvent).toHaveBeenCalledTimes(2)
  })

  it('video_id 不存在（FK violation） → 204，不返回 400', async () => {
    mockUpsertBrokenImageEvent.mockRejectedValueOnce({ code: '23503', message: 'FK violation' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/image-broken',
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(204)
  })

  it('url 超过 2048 字符 → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/image-broken',
      payload: { ...VALID_BODY, url: 'https://cdn.example.com/' + 'a'.repeat(2048) },
    })
    expect(res.statusCode).toBe(400)
  })

  it('reason=fetch_404（服务端专用）→ 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/image-broken',
      payload: { ...VALID_BODY, reason: 'fetch_404' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('image_kind 非法 → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/image-broken',
      payload: { ...VALID_BODY, image_kind: 'unknown_kind' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('video_id 非 UUID → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/image-broken',
      payload: { ...VALID_BODY, video_id: 'not-a-uuid' },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── ADR-213 D-213-6：双写信号列（client_error_at）+ events 遥测 ───────
describe('POST /v1/internal/image-broken — 信号列双写（ADR-213 D-213-6）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('受治理 kind（poster）→ 同写信号列 + events，204', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/image-broken',
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(204)
    expect(mockMarkCatalogClientError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        videoId: VALID_BODY.video_id,
        kind: 'poster',
        url: VALID_BODY.url,
      })
    )
    expect(mockUpsertBrokenImageEvent).toHaveBeenCalledTimes(1)
  })

  it('stills / thumbnail → 跳信号列、仅 events（ADV-213-6）', async () => {
    for (const image_kind of ['stills', 'thumbnail'] as const) {
      vi.clearAllMocks()
      const app = await buildApp()
      const res = await app.inject({
        method: 'POST',
        url: '/v1/internal/image-broken',
        payload: { ...VALID_BODY, image_kind },
      })
      expect(res.statusCode).toBe(204)
      expect(mockMarkCatalogClientError).not.toHaveBeenCalled()
      expect(mockUpsertBrokenImageEvent).toHaveBeenCalledTimes(1)
    }
  })

  it('信号列写入失败 → best-effort 降级，遥测仍写、仍 204（互不阻断）', async () => {
    mockMarkCatalogClientError.mockRejectedValueOnce(new Error('db down'))
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/image-broken',
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(204)
    expect(mockUpsertBrokenImageEvent).toHaveBeenCalledTimes(1) // 信号列失败不阻断遥测
  })

  it('遥测写非 FK 错误 → best-effort 降级，仍 204（不抛 500）', async () => {
    mockUpsertBrokenImageEvent.mockRejectedValueOnce(new Error('telemetry write failed'))
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/image-broken',
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(204)
    expect(mockMarkCatalogClientError).toHaveBeenCalledTimes(1) // 信号列已先写
  })
})
