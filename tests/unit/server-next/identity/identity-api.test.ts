/**
 * identity-api.test.ts — lib/identity/api + lib/moderation/api envelope 客户端契约（CHG-VIR-9-C）
 *
 * 范围（6 用例）：
 *  - rejectIdentityCandidate：URL/encodeURIComponent/body（含 reason / 无 reason）/ data 解包
 *  - listSimilarVideos：source 参数序列化 + {data, source} envelope 解包 + source 缺省容错 legacy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
const postMock = vi.fn()

vi.mock('../../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: vi.fn(),
  },
}))

vi.mock('../../../../apps/server-next/src/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({ accessToken: null })),
}))

import { rejectIdentityCandidate } from '../../../../apps/server-next/src/lib/identity/api'
import { listSimilarVideos } from '../../../../apps/server-next/src/lib/moderation/api'

beforeEach(() => {
  getMock.mockReset()
  postMock.mockReset()
})

describe('identity/api — rejectIdentityCandidate（ADR-178）', () => {
  it('POST 到 /admin/identity-candidates/:id/reject + reason body + data 解包', async () => {
    postMock.mockResolvedValueOnce({
      data: { candidateId: 'cand-1', status: 'rejected', decisionId: 'dec-1' },
    })
    const res = await rejectIdentityCandidate('cand-1', '人工拒绝')
    expect(postMock).toHaveBeenCalledWith(
      '/admin/identity-candidates/cand-1/reject',
      { reason: '人工拒绝' },
    )
    expect(res).toEqual({ candidateId: 'cand-1', status: 'rejected', decisionId: 'dec-1' })
  })

  it('无 reason 时 body 为空对象', async () => {
    postMock.mockResolvedValueOnce({
      data: { candidateId: 'cand-2', status: 'rejected', decisionId: 'dec-2' },
    })
    await rejectIdentityCandidate('cand-2')
    expect(postMock).toHaveBeenCalledWith('/admin/identity-candidates/cand-2/reject', {})
  })

  it('candidateId 经 encodeURIComponent（防路径注入）', async () => {
    postMock.mockResolvedValueOnce({
      data: { candidateId: 'a/b', status: 'rejected', decisionId: 'dec-3' },
    })
    await rejectIdentityCandidate('a/b')
    expect(postMock).toHaveBeenCalledWith('/admin/identity-candidates/a%2Fb/reject', {})
  })
})

describe('moderation/api — listSimilarVideos envelope（CHG-VIR-9-C）', () => {
  it('source 参数序列化进 URL + {data, source} envelope 解包', async () => {
    getMock.mockResolvedValueOnce({ data: [{ id: 'v1' }], source: 'identity' })
    const res = await listSimilarVideos('vid-1', { limit: 10, source: 'identity' })
    expect(getMock).toHaveBeenCalledWith('/admin/moderation/vid-1/similar?limit=10&source=identity')
    expect(res.items).toEqual([{ id: 'v1' }])
    expect(res.source).toBe('identity')
  })

  it('source 缺省时不进 URL', async () => {
    getMock.mockResolvedValueOnce({ data: [], source: 'legacy' })
    await listSimilarVideos('vid-2', { limit: 5 })
    expect(getMock).toHaveBeenCalledWith('/admin/moderation/vid-2/similar?limit=5')
  })

  it('响应缺 source 字段时容错按 legacy（旧 API 兼容）', async () => {
    getMock.mockResolvedValueOnce({ data: [] })
    const res = await listSimilarVideos('vid-3')
    expect(res.source).toBe('legacy')
  })
})
