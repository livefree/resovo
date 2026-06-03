/**
 * tests/unit/api/video-merges-candidates-route.test.ts —
 * GET /admin/video-merges/candidates route 层 source 回显透传（CHG-VIR-9-C FIX / Codex review）
 *
 * 根因：Service 返回 `source` 但 route 重组响应时丢字段 → 前端 effectiveSource 恒 null →
 * merge 工作台降级提示永不显示（lib 层单测 mock 在 api 客户端，漏过 route 缺口）。
 *
 * 覆盖（2 用例）：
 *   #1 source=identity 且 Service 降级返回 legacy → body.source='legacy'（降级回显可达前端）
 *   #2 Service 返回 identity → body.source='identity' + query source 透传给 Service
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
})
