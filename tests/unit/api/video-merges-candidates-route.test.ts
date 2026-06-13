/**
 * tests/unit/api/video-merges-candidates-route.test.ts —
 * GET /admin/video-merges/candidates route 层 source 回显透传（CHG-VIR-9-C FIX / Codex review）
 *
 * 根因：Service 返回 `source` 但 route 重组响应时丢字段 → 前端 effectiveSource 恒 null →
 * merge 工作台降级提示永不显示（lib 层单测 mock 在 api 客户端，漏过 route 缺口）。
 *
 * 覆盖（route envelope 字段透传机制——同型「字段丢弃」缺口三次防御）：
 *   #1/#2 source 回显透传（CHG-VIR-9-C FIX；CHG-VIR-18 后 Service 恒 identity，#1 mock 验证 route 不挑值）
 *   #3/#4 truncated 透传（CHG-VIR-16-TBL FIX / D-105a-19）+ 检索参数 zod 解析透传 / 非截断态不携带键
 *   #5/#6 staleIdentityPending 透传（CHG-VIR-18 D-105-22 / GOV-2 修缺口）+ 正常态不携带键
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/lib/postgres', () => ({ db: { query: vi.fn() } }))
vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

const listCandidatesMock = vi.fn()

// 部分 mock：替换 Service 类，保留 zod schemas（route 真实解析 query）
vi.mock('@/api/services/VideoMergesService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/services/VideoMergesService')>()
  return {
    ...actual,
    VideoMergesService: class {
      listCandidates = (...args: unknown[]) => listCandidatesMock(...args)
    },
  }
})

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>
const ADMIN_USER_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
})

async function buildApp() {
  const { adminVideoMergesRoutes } = await import('@/api/routes/admin/video-merges')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminVideoMergesRoutes)
  await app.ready()
  return app
}

function adminAuth() {
  mockVerify.mockReturnValue({ userId: ADMIN_USER_ID, role: 'admin', iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

describe('GET /admin/video-merges/candidates — source 回显透传（CHG-VIR-9-C FIX）', () => {
  it('#1 source=identity 但 Service 降级 legacy → body.source=legacy（降级回显可达前端）', async () => {
    listCandidatesMock.mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 20, source: 'legacy' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/video-merges/candidates?source=identity',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { source?: string }
    expect(body.source).toBe('legacy')
    await app.close()
  })

  it('#2 Service 返回 identity → body.source=identity + query source 透传给 Service', async () => {
    listCandidatesMock.mockResolvedValueOnce({ data: [], total: 1, page: 1, limit: 20, source: 'identity' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/video-merges/candidates?source=identity',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { source?: string }
    expect(body.source).toBe('identity')
    // zod 解析后的 query 透传 Service（default 链路完整）
    expect(listCandidatesMock).toHaveBeenCalledWith(expect.objectContaining({ source: 'identity' }))
    await app.close()
  })

  // ── CHG-VIR-16-TBL FIX（Codex review）：truncated 透传（与 #1 source 丢字段同型缺口）──

  it('#3 Service 返回 truncated:true → body.truncated=true + 检索参数 zod 解析透传 Service', async () => {
    listCandidatesMock.mockResolvedValueOnce({
      data: [], total: 5, page: 1, limit: 20, source: 'identity', truncated: true,
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/video-merges/candidates?identityScoreMin=0.8&videoCountMin=3&q=%E6%96%97%E7%A0%B4&sortField=identityScore&sortDir=asc',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { truncated?: boolean }
    expect(body.truncated).toBe(true)
    // D-105a-19 检索参数 coerce 解析后透传 Service
    expect(listCandidatesMock).toHaveBeenCalledWith(expect.objectContaining({
      identityScoreMin: 0.8, videoCountMin: 3, q: '斗破', sortField: 'identityScore', sortDir: 'asc',
    }))
    await app.close()
  })

  it('#4 Service 未填 truncated（非截断态/legacy）→ body 不携带 truncated 键', async () => {
    listCandidatesMock.mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 20, source: 'identity' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/video-merges/candidates',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).not.toHaveProperty('truncated')
    await app.close()
  })

  // ── CHG-VIR-18 D-105-22（GOV-2 修缺口）：staleIdentityPending 透传（同型字段丢弃缺口第三次防御）──

  it('#5 Service identity 空态返回 staleIdentityPending:true → body.staleIdentityPending=true（GOV-2 警示可达前端）', async () => {
    listCandidatesMock.mockResolvedValueOnce({
      data: [], total: 0, page: 1, limit: 20, source: 'identity', staleIdentityPending: true,
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/video-merges/candidates?source=identity',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { staleIdentityPending?: boolean }
    expect(body.staleIdentityPending).toBe(true)
    await app.close()
  })

  it('#6 Service 未填 staleIdentityPending（正常 identity 候选）→ body 不携带该键', async () => {
    listCandidatesMock.mockResolvedValueOnce({ data: [], total: 1, page: 1, limit: 20, source: 'identity' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/video-merges/candidates',
      headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).not.toHaveProperty('staleIdentityPending')
    await app.close()
  })
})
