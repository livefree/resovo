/**
 * tests/unit/api/bangumi-lib.test.ts — lib/bangumi.ts REST 客户端（ADR-161 / CHG-BNG-03 / ADR-189 埋点+扩端点）
 * mock config（提供 Token）+ 全局 fetch + recordFetch；验证鉴权头、降级、分页、搜索、埋点、calendar/sorted。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 埋点 recorder mock（保留 classifyFetchError/fetchErrorSummary 真实；recordFetch 为 spy 防真实 DB 写）
const { recordFetch } = vi.hoisted(() => ({ recordFetch: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/api/lib/external-fetch-recorder', async (orig) => ({
  ...(await orig<typeof import('@/api/lib/external-fetch-recorder')>()),
  recordFetch,
}))

// lib/bangumi 直接读 process.env（不依赖 config 单例）；测试注入 Token/UA
import {
  getSubject, getEpisodes, getCharacters, searchSubjects, searchSubjectsStrict,
  getCalendar, searchSubjectsSorted, isBangumiApiConfigured,
} from '@/api/lib/bangumi'

function okJson(body: unknown) {
  return { ok: true, json: async () => body }
}
function errResp(status: number) {
  return { ok: false, status, json: async () => ({}) }
}
/** 取最近一次 recordFetch 入参 */
function lastRecord() {
  return recordFetch.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  recordFetch.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('BANGUMI_API_TOKEN', 'test-token')
  vi.stubEnv('BANGUMI_USER_AGENT', 'resovo-test/1.0')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('lib/bangumi getSubject', () => {
  it('成功返回 subject 并带 Bearer + UA 头 + 埋点 detail/api/ok', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 1, name: 'CLANNAD', name_cn: '团子大家族' }))
    const subject = await getSubject(1, undefined, 'enrich_worker')
    expect(subject?.name_cn).toBe('团子大家族')
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer test-token')
    expect(init.headers['User-Agent']).toBe('resovo-test/1.0')
    expect(lastRecord()).toMatchObject({ provider: 'bangumi', operation: 'detail', method: 'api', status: 'ok', source: 'enrich_worker', itemCount: 1 })
  })

  it('404 返回 null + 埋点 ok（valid negative 不计失败）', async () => {
    fetchMock.mockResolvedValue(errResp(404))
    expect(await getSubject(1)).toBeNull()
    expect(lastRecord()).toMatchObject({ operation: 'detail', status: 'ok', itemCount: 0 })
  })

  it('5xx 返回 null + 埋点 fail', async () => {
    fetchMock.mockResolvedValue(errResp(503))
    expect(await getSubject(1)).toBeNull()
    expect(lastRecord()).toMatchObject({ operation: 'detail', status: 'fail' })
  })

  it('fetch 抛异常返回 null（降级，不抛）+ 埋点 fail/timeout', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'))
    expect(await getSubject(1)).toBeNull()
    expect(lastRecord()).toMatchObject({ operation: 'detail' })
    expect(['fail', 'timeout']).toContain(lastRecord()?.status)
  })
})

describe('lib/bangumi getEpisodes 分页', () => {
  it('拉全多页并在达到 total 时停止 + 埋点 detail itemCount=150', async () => {
    const page0 = { data: Array.from({ length: 100 }, (_, i) => ({ id: i })), total: 150 }
    const page1 = { data: Array.from({ length: 50 }, (_, i) => ({ id: 100 + i })), total: 150 }
    fetchMock.mockResolvedValueOnce(okJson(page0)).mockResolvedValueOnce(okJson(page1))
    const eps = await getEpisodes(42)
    expect(eps).toHaveLength(150)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(lastRecord()).toMatchObject({ operation: 'detail', method: 'api', status: 'ok', itemCount: 150 })
  })

  it('空 data 立即停止返回 []', async () => {
    fetchMock.mockResolvedValue(okJson({ data: [], total: 0 }))
    expect(await getEpisodes(42)).toEqual([])
  })

  it('请求失败返回 []（降级，保留已得部分）', async () => {
    fetchMock.mockResolvedValue(errResp(500))
    expect(await getEpisodes(42)).toEqual([])
    expect(lastRecord()).toMatchObject({ operation: 'detail', status: 'fail', itemCount: 0 })
  })
})

describe('lib/bangumi getCharacters（META-19）', () => {
  it('成功返回角色数组 + 埋点 celebrity/api/ok', async () => {
    fetchMock.mockResolvedValue(okJson([
      { id: 1, name: 'A', type: 1, images: null, relation: '主角', summary: '', actors: [{ id: 9, name: 'CV', type: 1, images: null }] },
    ]))
    const chars = await getCharacters(42)
    expect(chars).toHaveLength(1)
    expect(chars![0].actors[0].name).toBe('CV')
    expect(lastRecord()).toMatchObject({ operation: 'celebrity', method: 'api', status: 'ok', itemCount: 1 })
  })

  it('成功返回空数组（空作品）—— 区分于失败', async () => {
    fetchMock.mockResolvedValue(okJson([]))
    expect(await getCharacters(42)).toEqual([])
  })

  it('请求失败返回 null（与成功空 [] 区分，不抛）+ 埋点 fail', async () => {
    fetchMock.mockRejectedValue(new Error('boom'))
    expect(await getCharacters(42)).toBeNull()
    expect(lastRecord()).toMatchObject({ operation: 'celebrity', status: 'fail' })
  })

  it('非数组响应返回 null（防御）+ 埋点 fail', async () => {
    fetchMock.mockResolvedValue(okJson({ unexpected: true }))
    expect(await getCharacters(42)).toBeNull()
    expect(lastRecord()).toMatchObject({ operation: 'celebrity', status: 'fail' })
  })
})

describe('lib/bangumi searchSubjects / searchSubjectsStrict', () => {
  it('POST type=2 过滤，返回候选 + 埋点 search/api/ok', async () => {
    fetchMock.mockResolvedValue(okJson({ data: [{ id: 9, name: 'x', name_cn: 'X' }] }))
    const items = await searchSubjects('CLANNAD', 10, undefined, 'admin_search')
    expect(items).toHaveLength(1)
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).filter.type).toEqual([2])
    expect(lastRecord()).toMatchObject({ operation: 'search', method: 'api', status: 'ok', source: 'admin_search', itemCount: 1 })
  })

  it('searchSubjects 失败返回 []（strict 抛 + 埋点 fail；宽容版吞不重复埋）', async () => {
    fetchMock.mockRejectedValue(new Error('boom'))
    expect(await searchSubjects('x')).toEqual([])
    expect(lastRecord()).toMatchObject({ operation: 'search', status: 'fail' })
    expect(recordFetch).toHaveBeenCalledTimes(1) // 不双计
  })

  it('searchSubjectsStrict 失败 re-throw + 埋点 fail', async () => {
    fetchMock.mockResolvedValue(errResp(429))
    await expect(searchSubjectsStrict('x')).rejects.toThrow()
    expect(lastRecord()).toMatchObject({ operation: 'search', status: 'fail' })
  })
})

describe('lib/bangumi getCalendar（ADR-189 D-189-5）', () => {
  it('成功返回 7 天数组 + 埋点 schedule/api/ok（itemCount=总条目）', async () => {
    fetchMock.mockResolvedValue(okJson([
      { weekday: { id: 1, en: 'Mon', cn: '星期一', ja: '月耀日' }, items: [{ id: 1 }, { id: 2 }] },
      { weekday: { id: 2, en: 'Tue', cn: '星期二', ja: '火耀日' }, items: [{ id: 3 }] },
    ]))
    const days = await getCalendar(undefined, 'collections_worker')
    expect(days).toHaveLength(2)
    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('/calendar')
    expect(lastRecord()).toMatchObject({ operation: 'schedule', method: 'api', status: 'ok', source: 'collections_worker', itemCount: 3 })
  })

  it('抓取失败返回 null（失败信号，arch H3）+ 埋点 fail', async () => {
    fetchMock.mockRejectedValue(new Error('boom'))
    expect(await getCalendar()).toBeNull()
    expect(lastRecord()).toMatchObject({ operation: 'schedule', status: 'fail' })
  })
})

describe('lib/bangumi searchSubjectsSorted（ADR-189 D-189-5）', () => {
  it('sort=heat + filter type=2 默认，返回候选 + 埋点 collection/api/ok', async () => {
    fetchMock.mockResolvedValue(okJson({ data: [{ id: 1 }, { id: 2 }] }))
    const items = await searchSubjectsSorted({ sort: 'heat' }, undefined, 'collections_worker')
    expect(items).toHaveLength(2)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/v0/search/subjects')
    const body = JSON.parse(init.body)
    expect(body.sort).toBe('heat')
    expect(body.filter.type).toEqual([2])
    expect(lastRecord()).toMatchObject({ operation: 'collection', method: 'api', status: 'ok', source: 'collections_worker', target: 'heat', itemCount: 2 })
  })

  it('air_date filter 透传 + offset 分页', async () => {
    fetchMock.mockResolvedValue(okJson({ data: [] }))
    await searchSubjectsSorted({ sort: 'rank', filter: { air_date: ['>=2026-01-01'] }, offset: 50 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('offset=50')
    expect(JSON.parse(init.body).filter.air_date).toEqual(['>=2026-01-01'])
  })

  it('抓取失败返回 null（失败信号）+ 埋点 fail', async () => {
    fetchMock.mockResolvedValue(errResp(500))
    expect(await searchSubjectsSorted({ sort: 'rank' })).toBeNull()
    expect(lastRecord()).toMatchObject({ operation: 'collection', status: 'fail' })
  })
})

describe('lib/bangumi isBangumiApiConfigured', () => {
  it('Token 已配置返回 true', () => {
    expect(isBangumiApiConfigured()).toBe(true)
  })
})
