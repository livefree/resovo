/**
 * adminSearchService.test.ts — SEARCH-02-A 后台搜索 fan-out 编排单测（ADR-200）
 *
 * 覆盖：kind 优先级分组 / 权限分级（moderator 不返 user）/ Promise.allSettled 局部降级 /
 *       组内精确命中置顶 / 空 query 短路 / limit 截断
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import type { Client } from '@elastic/elasticsearch'

const { mockSearchAdminSources, mockSearchAdminUsers, mockSearchTaskRuns } = vi.hoisted(() => ({
  mockSearchAdminSources: vi.fn(),
  mockSearchAdminUsers: vi.fn(),
  mockSearchTaskRuns: vi.fn(),
}))

vi.mock('@/api/lib/elasticsearch', () => ({ ES_INDEX: 'resovo_videos', es: {} }))
vi.mock('@/api/db/queries/sources', () => ({ searchAdminSources: mockSearchAdminSources }))
vi.mock('@/api/db/queries/users', () => ({ searchAdminUsers: mockSearchAdminUsers }))
vi.mock('@/api/db/queries/taskRuns', () => ({
  searchTaskRuns: mockSearchTaskRuns,
  TASK_RUN_STATUS_MAP: {
    pending: 'pending', running: 'running', cancelling: 'running',
    success: 'success', failed: 'failed', cancelled: 'failed',
  },
}))

import { AdminSearchService } from '@/api/services/AdminSearchService'

function esWith(hits: unknown[]): Client {
  return { search: vi.fn().mockResolvedValue({ hits: { hits } }) } as unknown as Client
}

function videoHit(source: Record<string, unknown>, score = 1, highlight?: Record<string, string[]>) {
  return { _source: source, _score: score, highlight }
}

const DB = {} as unknown as Pool

beforeEach(() => {
  vi.clearAllMocks()
  mockSearchAdminSources.mockResolvedValue([])
  mockSearchAdminUsers.mockResolvedValue([])
  mockSearchTaskRuns.mockResolvedValue([])
})

describe('AdminSearchService.search — fan-out + 分组', () => {
  it('admin 角色 fan-out 四 kind，按固定优先级 video>source>user>task 排序', async () => {
    const es = esWith([videoHit({ id: 'v1', short_id: 'sh1', title: '钢铁侠', type: 'movie', year: 2008, status: 'completed', review_status: 'approved', visibility_status: 'public' })])
    mockSearchAdminSources.mockResolvedValue([{ id: 's1', source_name: '线路A', source_url: 'http://x', video_id: 'v1', video_title: '钢铁侠', site_key: 'sk' }])
    mockSearchAdminUsers.mockResolvedValue([{ id: 'u1', username: 'tony', email: 't@x.io', role: 'user' }])
    mockSearchTaskRuns.mockResolvedValue([{ id: 't1', kind: 'crawl', title: '采集任务', ref: null, status: 'running', progress: null, digest: null, error: null, startedAt: new Date('2026-06-13T00:00:00Z'), finishedAt: null, createdAt: new Date('2026-06-13T00:00:00Z') }])

    const svc = new AdminSearchService(es, DB)
    const res = await svc.search('钢铁', { limit: 8, role: 'admin' })

    expect(res.query).toBe('钢铁')
    expect(res.groups.map((g) => g.kind)).toEqual(['video', 'source', 'user', 'task'])
    expect(res.groups[0]!.items[0]).toMatchObject({ kind: 'video', id: 'v1', payload: { shortId: 'sh1', type: 'movie', reviewStatus: 'approved' } })
    expect(res.groups[3]!.items[0]).toMatchObject({ kind: 'task', payload: { status: 'running', lastRunAt: '2026-06-13T00:00:00.000Z' } })
  })

  it('moderator 不返 user 组（D-200-5 权限分级），且不调 searchAdminUsers', async () => {
    const es = esWith([])
    mockSearchAdminSources.mockResolvedValue([{ id: 's1', source_name: 'L', source_url: 'u', video_id: 'v1', video_title: 'T', site_key: null }])
    const svc = new AdminSearchService(es, DB)
    const res = await svc.search('x', { limit: 8, role: 'moderator' })
    expect(res.groups.map((g) => g.kind)).not.toContain('user')
    expect(mockSearchAdminUsers).not.toHaveBeenCalled()
  })

  it('某 searcher 抛错 → 该组 degraded、其余 kind 不受影响（Promise.allSettled）', async () => {
    const es = esWith([videoHit({ id: 'v1', short_id: 's', title: 'abc', type: 'movie', year: null, status: 'completed', review_status: 'approved', visibility_status: 'public' })])
    mockSearchAdminSources.mockRejectedValue(new Error('db down'))
    const svc = new AdminSearchService(es, DB)
    const res = await svc.search('abc', { limit: 8, role: 'admin' })
    const sourceGroup = res.groups.find((g) => g.kind === 'source')
    expect(sourceGroup).toMatchObject({ degraded: true, items: [] })
    expect(res.groups.find((g) => g.kind === 'video')!.items).toHaveLength(1)
  })

  it('ES videos 宕机 → video 组 degraded（D-200-7），其余 kind 正常', async () => {
    const es = { search: vi.fn().mockRejectedValue(new Error('es down')) } as unknown as Client
    mockSearchAdminUsers.mockResolvedValue([{ id: 'u1', username: 'a', email: 'a@x.io', role: 'admin' }])
    const svc = new AdminSearchService(es, DB)
    const res = await svc.search('a', { limit: 8, role: 'admin' })
    expect(res.groups.find((g) => g.kind === 'video')).toMatchObject({ degraded: true })
    expect(res.groups.find((g) => g.kind === 'user')!.items).toHaveLength(1)
  })

  it('组内精确 short_id 命中置顶（reason 优先于 score）', async () => {
    const es = esWith([
      videoHit({ id: 'v1', short_id: 'other', title: '完全匹配标题', type: 'movie', year: null, status: 'completed', review_status: 'approved', visibility_status: 'public' }, 9),
      videoHit({ id: 'v2', short_id: 'ab12cd', title: '不相关', type: 'movie', year: null, status: 'completed', review_status: 'approved', visibility_status: 'public' }, 1),
    ])
    const svc = new AdminSearchService(es, DB)
    const res = await svc.search('ab12cd', { limit: 8, role: 'admin' })
    const videoItems = res.groups.find((g) => g.kind === 'video')!.items
    expect(videoItems[0]).toMatchObject({ id: 'v2', reason: 'exact-short-id' })
  })

  it('空白 query 短路：不调任何 searcher，返回空 groups', async () => {
    const es = esWith([])
    const svc = new AdminSearchService(es, DB)
    const res = await svc.search('   ', { limit: 8, role: 'admin' })
    expect(res).toEqual({ query: '', groups: [] })
    expect(es.search).not.toHaveBeenCalled()
    expect(mockSearchTaskRuns).not.toHaveBeenCalled()
  })

  it('组内 top-N 截断到 limit', async () => {
    const hits = Array.from({ length: 5 }, (_, i) => videoHit({ id: `v${i}`, short_id: `s${i}`, title: `标题${i}`, type: 'movie', year: null, status: 'completed', review_status: 'approved', visibility_status: 'public' }, 5 - i))
    const es = esWith(hits)
    const svc = new AdminSearchService(es, DB)
    const res = await svc.search('标题', { limit: 3, role: 'admin' })
    expect(res.groups.find((g) => g.kind === 'video')!.items).toHaveLength(3)
  })

  it('video href 带 v.f.q deep-link（videos 列表 urlNamespace=v）', async () => {
    const es = esWith([videoHit({ id: 'v1', short_id: 's', title: '我的标题', type: 'movie', year: null, status: 'completed', review_status: 'approved', visibility_status: 'public' })])
    const svc = new AdminSearchService(es, DB)
    const res = await svc.search('我的', { limit: 8, role: 'admin' })
    expect(res.groups.find((g) => g.kind === 'video')!.items[0]!.href).toBe(`/admin/videos?v.f.q=${encodeURIComponent('我的标题')}`)
  })
})
