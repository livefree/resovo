/**
 * tests/unit/api/sources.test.ts
 * PLAYER-01: GET /videos/:id/sources, POST /videos/:id/sources/:sid/report 测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'

import { setupAuthenticate } from '@/api/plugins/authenticate'
import { signAccessToken } from '@/api/lib/auth'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}))

vi.mock('@/api/lib/postgres', () => ({ db: {} }))

vi.mock('@/api/db/queries/sources', () => ({
  findActiveSourcesByVideoId: vi.fn(),
  findActiveSourcesWithSignalsByVideoId: vi.fn(),
  mapSourceBase: vi.fn((row: Record<string, unknown>) => ({
    id: row.id,
    videoId: row.video_id,
    episodeNumber: row.episode_number,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    siteDisplayName: row.site_display_name ?? null,
    quality: row.quality ?? null,
    type: row.type,
    isActive: row.is_active,
    lastChecked: row.last_checked ?? null,
  })),
  findSourceById: vi.fn(),
  updateSourceActiveStatus: vi.fn(),
}))

vi.mock('@/api/db/queries/videos', () => ({
  findVideoByShortId: vi.fn(),
  listVideos: vi.fn(),
  listTrendingVideos: vi.fn(),
}))

import * as sourceQueries from '@/api/db/queries/sources'
import * as videoQueries from '@/api/db/queries/videos'

const mockSQ = sourceQueries as {
  findActiveSourcesByVideoId: ReturnType<typeof vi.fn>
  findActiveSourcesWithSignalsByVideoId: ReturnType<typeof vi.fn>
  findSourceById: ReturnType<typeof vi.fn>
}
const mockVQ = videoQueries as {
  findVideoByShortId: ReturnType<typeof vi.fn>
}

// ── 测试数据 ─────────────────────────────────────────────────────

const MOCK_VIDEO = {
  id: 'video-uuid-1',
  shortId: 'abCD1234',
  title: '测试电影',
  type: 'movie' as const,
  isPublished: true,
}

const MOCK_SOURCE = {
  id: 'source-uuid-1',
  videoId: 'video-uuid-1',
  episodeNumber: null,
  sourceUrl: 'https://cdn.example.com/video.m3u8', // ADR-001: 直链
  sourceName: '线路1',
  quality: '1080P' as const,
  type: 'hls' as const,
  isActive: true,
  lastChecked: null,
}

// CHG-352: SourceService 现在调 findActiveSourcesWithSignalsByVideoId 返回 raw row (snake_case + 4 信号字段)
// CHG-368-B-A3: 扩 alias_priority 字段（source_line_aliases.priority LEFT JOIN）
const MOCK_RAW_ROW = {
  id: 'source-uuid-1',
  video_id: 'video-uuid-1',
  season_number: 1,
  episode_number: null,
  source_url: 'https://cdn.example.com/video.m3u8',
  source_name: '线路1',
  site_display_name: null,
  quality: '1080P',
  type: 'hls',
  is_active: true,
  submitted_by: null,
  last_checked: null,
  deleted_at: null,
  created_at: '2026-05-27T00:00:00Z',
  probe_status: 'ok',
  render_status: 'ok',
  latency_ms: 100,
  quality_detected: null,
  alias_priority: null,  // CHG-368-B-A3: LEFT JOIN miss / fallback 0（与 Phase 1 行为一致）
  host_tripped: false,   // SRCHEALTH-P3-3-B2: host_health LEFT JOIN（miss → COALESCE false）
  // SRCHEALTH-P3-1: 近期时间戳（age≈0 落在 grace/零衰减区 → 0.86/0.90 等既有断言不漂移；
  // null 会与 probe_status='ok' 语义矛盾——null ⇔ 从未探测 ⇔ 必为 pending，裁决 E）
  last_probed_at: new Date().toISOString(),
  last_rendered_at: new Date().toISOString(),
}

// ── 辅助：测试 app ────────────────────────────────────────────────

async function buildApp() {
  const { sourceRoutes } = await import('@/api/routes/sources')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(sourceRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

// ═══════════════════════════════════════════════════════════════
// GET /v1/videos/:id/sources
// ═══════════════════════════════════════════════════════════════

describe('GET /v1/videos/:id/sources', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockVQ.findVideoByShortId.mockResolvedValue(MOCK_VIDEO)
    // CHG-352: SourceService 改用 findActiveSourcesWithSignalsByVideoId (返回 raw row)
    mockSQ.findActiveSourcesWithSignalsByVideoId.mockResolvedValue([MOCK_RAW_ROW])
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('只返回 is_active=true 的播放源', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/sources' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].isActive).toBe(true)
  })

  it('ADR-001 验证：响应包含 source_url 直链，不含代理路径', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/sources' })
    const source = res.json().data[0]
    // source_url 必须是直链（以 http 开头，不含 /proxy/ 路径）
    expect(source.sourceUrl).toMatch(/^https?:\/\//)
    expect(source.sourceUrl).not.toContain('/proxy/')
  })

  it('?episode=1 参数传递给查询函数', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/abCD1234/sources?episode=1',
    })
    expect(res.statusCode).toBe(200)
    // CHG-352: SourceService 改用 findActiveSourcesWithSignalsByVideoId
    const callArgs = mockSQ.findActiveSourcesWithSignalsByVideoId.mock.calls[0]
    expect(callArgs[2]).toBe(1) // episode 参数
  })

  it('视频不存在 → 404', async () => {
    mockVQ.findVideoByShortId.mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: '/v1/videos/notfound/sources' })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('无播放源时返回空数组', async () => {
    mockSQ.findActiveSourcesWithSignalsByVideoId.mockResolvedValue([])
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/sources' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([])
  })

  // ── CHG-368-B-A3 / ADR-164 D-164-3：priority 通道激活 ──────────────

  it('CHG-368-B-A3: alias_priority=80 → effectiveScore 包含 priority_bonus (priority/100 × 0.05 = 0.04)', async () => {
    // 全 ok + 1080P + 100ms + priority=80（test 间接证：priority=80 比 priority=0 多 0.04 / 0.05 weight × 0.80）
    mockSQ.findActiveSourcesWithSignalsByVideoId.mockResolvedValue([{
      ...MOCK_RAW_ROW,
      alias_priority: 80,
    }])
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/sources' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(1)
    // effectiveScore = 0.86 (priority=0 baseline) + 0.04 (priority/100 × 0.05) = 0.90
    expect(body.data[0].effectiveScore).toBeCloseTo(0.90, 3)
  })

  it('CHG-368-B-A3: alias_priority=null (LEFT JOIN miss) → priority_bonus=0 fallback (与 Phase 1 行为一致)', async () => {
    mockSQ.findActiveSourcesWithSignalsByVideoId.mockResolvedValue([{
      ...MOCK_RAW_ROW,
      alias_priority: null,
    }])
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/sources' })
    expect(res.statusCode).toBe(200)
    // effectiveScore baseline (priority=0)：与 Phase 1 ship 数学一致
    expect(res.json().data[0].effectiveScore).toBeCloseTo(0.86, 3)
  })

  it('CHG-368-B-A3: 高 priority (90) 排前 / 低 priority (10) 排后 (effective_score DESC)', async () => {
    // 两条线路：除 priority 外完全相同 → priority 主导排序
    mockSQ.findActiveSourcesWithSignalsByVideoId.mockResolvedValue([
      { ...MOCK_RAW_ROW, id: 'low-priority-src', source_name: '线路低', alias_priority: 10 },
      { ...MOCK_RAW_ROW, id: 'high-priority-src', source_name: '线路高', alias_priority: 90 },
    ])
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/sources' })
    const body = res.json()
    expect(body.data).toHaveLength(2)
    expect(body.data[0].id).toBe('high-priority-src')
    expect(body.data[1].id).toBe('low-priority-src')
  })

  // ── SRCHEALTH-P3-3-B2：熔断排序分桶（arch-reviewer claude-opus-4-8 裁决 C2/C3/C4）──
  // 排序层校准表：route-scoring max=1.00/min=0.020/中性=0.345 三值不变（公式零侵入）；
  // 分桶不变式 = tripped 桶整体后置、桶内保原 effectiveScore 序。

  it('P3-3-B2 关键校准：熔断 ok 源排在非熔断 dead 源之后（熔断 = 整台 CDN 此刻不可达的强信号）', async () => {
    mockSQ.findActiveSourcesWithSignalsByVideoId.mockResolvedValue([
      // 熔断主机上的全 ok 源（原分最高）
      { ...MOCK_RAW_ROW, id: 'tripped-ok', host_tripped: true },
      // 非熔断的 dead 源（原分最低）
      { ...MOCK_RAW_ROW, id: 'healthy-dead', probe_status: 'dead', render_status: 'dead', quality: '240P', latency_ms: 3000 },
    ])
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/sources' })
    const body = res.json()
    expect(body.data.map((s: { id: string }) => s.id)).toEqual(['healthy-dead', 'tripped-ok'])
  })

  it('P3-3-B2: tripped 桶内保原 effectiveScore 序（桶内 ok > dead）', async () => {
    mockSQ.findActiveSourcesWithSignalsByVideoId.mockResolvedValue([
      { ...MOCK_RAW_ROW, id: 'tripped-dead', host_tripped: true, probe_status: 'dead', render_status: 'dead' },
      { ...MOCK_RAW_ROW, id: 'tripped-ok', host_tripped: true },
      { ...MOCK_RAW_ROW, id: 'healthy-ok', host_tripped: false },
    ])
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/sources' })
    const body = res.json()
    expect(body.data.map((s: { id: string }) => s.id)).toEqual(['healthy-ok', 'tripped-ok', 'tripped-dead'])
  })

  it('P3-1 集成：Service 端衰减生效——6 天前 ok 源排在新近 ok 源之后（D3 修复，覆盖 now/时间戳传参链）', async () => {
    const sixDaysAgo = new Date(Date.now() - 144 * 3_600_000).toISOString()
    mockSQ.findActiveSourcesWithSignalsByVideoId.mockResolvedValue([
      { ...MOCK_RAW_ROW, id: 'stale-ok', last_probed_at: sixDaysAgo, last_rendered_at: sixDaysAgo },
      { ...MOCK_RAW_ROW, id: 'fresh-ok' },
    ])
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/sources' })
    const body = res.json()
    expect(body.data.map((s: { id: string }) => s.id)).toEqual(['fresh-ok', 'stale-ok'])
    // 衰减后分差显著（fresh 0.86 vs stale ≈0.663，quality=1080P/latency=100 同 Case 8 主验证）
    const fresh = body.data.find((s: { id: string }) => s.id === 'fresh-ok')
    const stale = body.data.find((s: { id: string }) => s.id === 'stale-ok')
    expect(fresh.effectiveScore - stale.effectiveScore).toBeGreaterThan(0.15)
  })

  it('P3-3-B2: effectiveScore 透出原值不含降权 + hostTripped 字段透出（裁决 C4——P3-2 影子基线/P3-4 切线语义稳定）', async () => {
    mockSQ.findActiveSourcesWithSignalsByVideoId.mockResolvedValue([
      { ...MOCK_RAW_ROW, id: 'tripped-ok', host_tripped: true },
      { ...MOCK_RAW_ROW, id: 'healthy-ok', host_tripped: false },
    ])
    const res = await app.inject({ method: 'GET', url: '/v1/videos/abCD1234/sources' })
    const body = res.json()
    const tripped = body.data.find((s: { id: string }) => s.id === 'tripped-ok')
    const healthy = body.data.find((s: { id: string }) => s.id === 'healthy-ok')
    // 同信号同分：熔断不修改 effectiveScore 数值（降权仅在排序维度）
    expect(tripped.effectiveScore).toBe(healthy.effectiveScore)
    expect(tripped.hostTripped).toBe(true)
    expect(healthy.hostTripped).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// POST /v1/videos/:id/sources/:sid/report
// ═══════════════════════════════════════════════════════════════

describe('POST /v1/videos/:id/sources/:sid/report', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockSQ.findSourceById.mockResolvedValue(MOCK_SOURCE)
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('未登录举报 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/sources/source-uuid-1/report',
      payload: { reason: 'broken' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('登录后举报成功 → 204', async () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/sources/source-uuid-1/report',
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'broken' },
    })
    expect(res.statusCode).toBe(204)
  })

  it('播放源不存在 → 404', async () => {
    mockSQ.findSourceById.mockResolvedValue(null)
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/sources/not-exist/report',
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'broken' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('无效举报原因 → 422', async () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/videos/abCD1234/sources/source-uuid-1/report',
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'invalid_reason' },
    })
    expect(res.statusCode).toBe(422)
  })
})

// ═══════════════════════════════════════════════════════════════
// POST /v1/sources/submit — 用户投稿功能已下线（CHG-VSR-8）
// ═══════════════════════════════════════════════════════════════
describe('POST /v1/sources/submit（已下线）', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('保留路由但返 410 FEATURE_RETIRED + 不写库（裁决 §5.1/§7-9 a）', async () => {
    const token = signAccessToken({ userId: 'user-1', role: 'user' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sources/submit',
      headers: { authorization: `Bearer ${token}` },
      payload: { videoId: '00000000-0000-0000-0000-000000000001', sourceUrl: 'https://e.com/a.m3u8' },
    })
    expect(res.statusCode).toBe(410)
    expect(res.json().error.code).toBe('FEATURE_RETIRED')
  })

  it('未登录也返 410（端点已下线，不再要求 auth）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sources/submit',
      payload: {},
    })
    expect(res.statusCode).toBe(410)
  })
})
