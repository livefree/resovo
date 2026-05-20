/**
 * subtitles/api.test.ts — 字幕审核 API 客户端单元测试（CHG-SN-5-02）
 *
 * 覆盖：
 * - listSubtitles: 参数序列化（page / limit / sortField / sortDir）
 * - approveSubtitle: 单条 endpoint 路径
 * - rejectSubtitle: 单条 endpoint 路径 + body（含/不含 reason）
 *
 * 不在范围：fetch 真实调用（由 apiClient 单测覆盖）；本测覆盖封装契约。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}))

import { apiClient } from '../../../../apps/server-next/src/lib/api-client'
import {
  listSubtitles,
  approveSubtitle,
  rejectSubtitle,
  fetchSubtitleStats,
  createAdminSubtitle,
} from '../../../../apps/server-next/src/lib/subtitles/api'

const mockedGet = vi.mocked(apiClient.get)
const mockedPost = vi.mocked(apiClient.post)

describe('listSubtitles — 参数序列化', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedGet.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 })
  })

  it('空 filter → /admin/subtitles?', async () => {
    await listSubtitles()
    expect(mockedGet).toHaveBeenCalledWith('/admin/subtitles?')
  })

  it('page+limit → query string 含 page/limit', async () => {
    await listSubtitles({ page: 2, limit: 50 })
    const url = mockedGet.mock.calls[0][0] as string
    expect(url).toContain('page=2')
    expect(url).toContain('limit=50')
  })

  it('sortField+sortDir → query string 含排序', async () => {
    await listSubtitles({ sortField: 'language', sortDir: 'asc' })
    const url = mockedGet.mock.calls[0][0] as string
    expect(url).toContain('sortField=language')
    expect(url).toContain('sortDir=asc')
  })

  it('返回 SubtitleListResult 结构', async () => {
    mockedGet.mockResolvedValue({
      data: [{ id: 's1', video_id: 'v1', video_title: '测试视频', episode_number: null, language: 'zh-CN', label: '中文简体', file_url: 'https://r2/sub.srt', format: 'srt', created_at: '2026-01-01' }],
      total: 1,
      page: 1,
      limit: 20,
    })
    const res = await listSubtitles()
    expect(res.total).toBe(1)
    expect(res.data).toHaveLength(1)
    expect(res.data[0]?.id).toBe('s1')
    expect(res.data[0]?.language).toBe('zh-CN')
  })

  it('仅 sortField 无 sortDir → query 仅含 sortField', async () => {
    await listSubtitles({ sortField: 'created_at' })
    const url = mockedGet.mock.calls[0][0] as string
    expect(url).toContain('sortField=created_at')
    expect(url).not.toContain('sortDir')
  })
})

describe('approveSubtitle', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedPost.mockResolvedValue({ data: { approved: true } })
  })

  it('POST /admin/subtitles/:id/approve', async () => {
    await approveSubtitle('sub-abc')
    expect(mockedPost).toHaveBeenCalledWith('/admin/subtitles/sub-abc/approve')
  })
})

describe('rejectSubtitle', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedPost.mockResolvedValue(undefined)
  })

  it('无 reason → body 为空对象', async () => {
    await rejectSubtitle('sub-abc')
    expect(mockedPost).toHaveBeenCalledWith('/admin/subtitles/sub-abc/reject', {})
  })

  it('含 reason → body 含 reason', async () => {
    await rejectSubtitle('sub-abc', '字幕语言不符')
    expect(mockedPost).toHaveBeenCalledWith('/admin/subtitles/sub-abc/reject', { reason: '字幕语言不符' })
  })
})

describe('createAdminSubtitle', () => {
  const INPUT = {
    videoId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    language: 'zh-CN',
    label: '中文简体',
    format: 'srt' as const,
    fileUrl: 'https://r2.example.com/subtitles/test.srt',
    episodeNumber: null,
  }

  beforeEach(() => {
    mockedPost.mockReset()
    mockedPost.mockResolvedValue(undefined)
  })

  it('POST /admin/subtitles', async () => {
    await createAdminSubtitle(INPUT)
    expect(mockedPost).toHaveBeenCalledWith('/admin/subtitles', INPUT)
  })

  it('含 episodeNumber → body 带 episodeNumber', async () => {
    const withEp = { ...INPUT, episodeNumber: 3 }
    await createAdminSubtitle(withEp)
    expect(mockedPost).toHaveBeenCalledWith('/admin/subtitles', withEp)
  })
})

describe('fetchSubtitleStats', () => {
  const MOCK_STATS = {
    pendingCount: 42,
    approvedTodayCount: 7,
    rejectedTodayCount: 3,
    totalVerifiedCount: 198,
    generatedAt: '2026-05-20T10:00:00.000Z',
  }

  beforeEach(() => {
    mockedGet.mockReset()
    mockedGet.mockResolvedValue({ data: MOCK_STATS })
  })

  it('GET /admin/subtitles/stats', async () => {
    await fetchSubtitleStats()
    expect(mockedGet).toHaveBeenCalledWith('/admin/subtitles/stats')
  })

  it('返回 data 字段中的 SubtitleStats 结构', async () => {
    const result = await fetchSubtitleStats()
    expect(result.pendingCount).toBe(42)
    expect(result.approvedTodayCount).toBe(7)
    expect(result.rejectedTodayCount).toBe(3)
    expect(result.totalVerifiedCount).toBe(198)
    expect(result.generatedAt).toBe('2026-05-20T10:00:00.000Z')
  })
})
