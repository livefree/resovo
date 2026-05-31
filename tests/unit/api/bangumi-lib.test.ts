/**
 * tests/unit/api/bangumi-lib.test.ts — lib/bangumi.ts REST 客户端（ADR-161 / CHG-BNG-03）
 * mock config（提供 Token）+ 全局 fetch；验证鉴权头、降级、分页、搜索。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// lib/bangumi 直接读 process.env（不依赖 config 单例）；测试注入 Token/UA
import { getSubject, getEpisodes, getCharacters, searchSubjects, isBangumiApiConfigured } from '@/api/lib/bangumi'

function okJson(body: unknown) {
  return { ok: true, json: async () => body }
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('BANGUMI_API_TOKEN', 'test-token')
  vi.stubEnv('BANGUMI_USER_AGENT', 'resovo-test/1.0')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('lib/bangumi getSubject', () => {
  it('成功返回 subject 并带 Bearer + UA 头', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 1, name: 'CLANNAD', name_cn: '团子大家族' }))
    const subject = await getSubject(1)
    expect(subject?.name_cn).toBe('团子大家族')
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer test-token')
    expect(init.headers['User-Agent']).toBe('resovo-test/1.0')
  })

  it('非 2xx 返回 null（降级）', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    expect(await getSubject(1)).toBeNull()
  })

  it('fetch 抛异常返回 null（降级，不抛）', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'))
    expect(await getSubject(1)).toBeNull()
  })
})

describe('lib/bangumi getEpisodes 分页', () => {
  it('拉全多页并在达到 total 时停止', async () => {
    const page0 = { data: Array.from({ length: 100 }, (_, i) => ({ id: i })), total: 150 }
    const page1 = { data: Array.from({ length: 50 }, (_, i) => ({ id: 100 + i })), total: 150 }
    fetchMock.mockResolvedValueOnce(okJson(page0)).mockResolvedValueOnce(okJson(page1))
    const eps = await getEpisodes(42)
    expect(eps).toHaveLength(150)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('空 data 立即停止返回 []', async () => {
    fetchMock.mockResolvedValue(okJson({ data: [], total: 0 }))
    expect(await getEpisodes(42)).toEqual([])
  })

  it('请求失败返回 []（降级）', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    expect(await getEpisodes(42)).toEqual([])
  })
})

describe('lib/bangumi getCharacters（META-19）', () => {
  it('成功返回角色数组（无分页，直接数组）', async () => {
    fetchMock.mockResolvedValue(okJson([
      { id: 1, name: 'A', type: 1, images: null, relation: '主角', summary: '', actors: [{ id: 9, name: 'CV', type: 1, images: null }] },
    ]))
    const chars = await getCharacters(42)
    expect(chars).toHaveLength(1)
    expect(chars[0].actors[0].name).toBe('CV')
    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('/v0/subjects/42/characters')
  })

  it('成功返回空数组（空作品）—— 区分于失败', async () => {
    fetchMock.mockResolvedValue(okJson([]))
    expect(await getCharacters(42)).toEqual([])
  })

  it('请求失败返回 null（与成功空 [] 区分，不抛）', async () => {
    fetchMock.mockRejectedValue(new Error('boom'))
    expect(await getCharacters(42)).toBeNull()
  })

  it('非数组响应返回 null（防御）', async () => {
    fetchMock.mockResolvedValue(okJson({ unexpected: true }))
    expect(await getCharacters(42)).toBeNull()
  })
})

describe('lib/bangumi searchSubjects', () => {
  it('POST type=2 过滤，返回候选', async () => {
    fetchMock.mockResolvedValue(okJson({ data: [{ id: 9, name: 'x', name_cn: 'X' }] }))
    const items = await searchSubjects('CLANNAD')
    expect(items).toHaveLength(1)
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).filter.type).toEqual([2])
  })

  it('失败返回 []', async () => {
    fetchMock.mockRejectedValue(new Error('boom'))
    expect(await searchSubjects('x')).toEqual([])
  })
})

describe('lib/bangumi isBangumiApiConfigured', () => {
  it('Token 已配置返回 true', () => {
    expect(isBangumiApiConfigured()).toBe(true)
  })
})
