/**
 * submissions/api.test.ts — 投稿审核 API 客户端单元测试（CHG-SN-5-01）
 *
 * 覆盖：
 * - listSubmissions: 参数序列化（page / limit / sortField / sortDir / videoType / siteKey）
 * - approveSubmission / rejectSubmission: 单条 endpoint 路径 + body
 * - batchApproveSubmissions / batchRejectSubmissions: 批量 endpoint + ids + reason
 *
 * 不在范围：fetch 真实调用（由 apiClient 单测覆盖）；本测覆盖封装契约。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}))

import { apiClient } from '../../../../apps/server-next/src/lib/api-client'
import {
  listSubmissions,
  approveSubmission,
  rejectSubmission,
  batchApproveSubmissions,
  batchRejectSubmissions,
} from '../../../../apps/server-next/src/lib/submissions/api'

const mockedGet = vi.mocked(apiClient.get)
const mockedPost = vi.mocked(apiClient.post)

describe('listSubmissions — 参数序列化', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedGet.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 })
  })

  it('空 filter → /admin/submissions?', async () => {
    await listSubmissions()
    expect(mockedGet).toHaveBeenCalledWith('/admin/submissions?')
  })

  it('page+limit → query string 含 page/limit', async () => {
    await listSubmissions({ page: 3, limit: 50 })
    const url = mockedGet.mock.calls[0][0] as string
    expect(url).toContain('page=3')
    expect(url).toContain('limit=50')
  })

  it('videoType+siteKey → query string 含两参数', async () => {
    await listSubmissions({ videoType: 'movie', siteKey: 'bilibili' })
    const url = mockedGet.mock.calls[0][0] as string
    expect(url).toContain('videoType=movie')
    expect(url).toContain('siteKey=bilibili')
  })

  it('sortField+sortDir → query string 含排序', async () => {
    await listSubmissions({ sortField: 'created_at', sortDir: 'desc' })
    const url = mockedGet.mock.calls[0][0] as string
    expect(url).toContain('sortField=created_at')
    expect(url).toContain('sortDir=desc')
  })

  it('返回 SubmissionListResult 结构', async () => {
    mockedGet.mockResolvedValue({
      data: [{ id: 'a', video_id: 'v', source_url: 'http://x', source_name: 's', submitted_by: null, created_at: '2026-01-01' }],
      total: 1,
      page: 1,
      limit: 20,
    })
    const res = await listSubmissions()
    expect(res.total).toBe(1)
    expect(res.data).toHaveLength(1)
    expect(res.data[0]?.id).toBe('a')
  })
})

describe('approveSubmission', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedPost.mockResolvedValue({ data: { approved: true } })
  })

  it('POST /admin/submissions/:id/approve', async () => {
    await approveSubmission('sub-123')
    expect(mockedPost).toHaveBeenCalledWith('/admin/submissions/sub-123/approve')
  })
})

describe('rejectSubmission', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedPost.mockResolvedValue(undefined)
  })

  it('无 reason → body 为空对象', async () => {
    await rejectSubmission('sub-123')
    expect(mockedPost).toHaveBeenCalledWith('/admin/submissions/sub-123/reject', {})
  })

  it('含 reason → body 含 reason', async () => {
    await rejectSubmission('sub-123', '内容与视频不符')
    expect(mockedPost).toHaveBeenCalledWith('/admin/submissions/sub-123/reject', { reason: '内容与视频不符' })
  })
})

describe('batchApproveSubmissions', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedPost.mockResolvedValue({ data: { approved: 2 } })
  })

  it('POST /admin/submissions/batch-approve { ids }', async () => {
    const n = await batchApproveSubmissions(['a', 'b'])
    expect(mockedPost).toHaveBeenCalledWith('/admin/submissions/batch-approve', { ids: ['a', 'b'] })
    expect(n).toBe(2)
  })
})

describe('batchRejectSubmissions', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedPost.mockResolvedValue({ data: { rejected: 3 } })
  })

  it('无 reason → body 仅 ids', async () => {
    await batchRejectSubmissions(['a', 'b', 'c'])
    expect(mockedPost).toHaveBeenCalledWith('/admin/submissions/batch-reject', { ids: ['a', 'b', 'c'] })
  })

  it('含 reason → body 含 reason', async () => {
    await batchRejectSubmissions(['a'], '重复提交')
    expect(mockedPost).toHaveBeenCalledWith('/admin/submissions/batch-reject', { ids: ['a'], reason: '重复提交' })
  })

  it('返回 rejected 计数', async () => {
    const n = await batchRejectSubmissions(['a', 'b', 'c'])
    expect(n).toBe(3)
  })
})
