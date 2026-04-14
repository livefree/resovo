/**
 * ModerationDetail.test.tsx
 * UX-11: 折叠块布局 + 豆瓣/源健康 block 渲染
 * UX-12: 基础信息块内联编辑（由 ModerationBasicInfoBlock 承担）
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ModerationDetail } from '@/components/admin/moderation/ModerationDetail'

const getMock = vi.fn()
const postMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}))

vi.mock('@/components/admin/moderation/ModerationPlayer', () => ({
  ModerationPlayer: () => <div data-testid="moderation-player-mock" />,
}))

vi.mock('@/components/admin/moderation/ModerationDoubanBlock', () => ({
  ModerationDoubanBlock: ({ doubanStatus }: { doubanStatus: string }) => (
    <div data-testid="douban-block-mock" data-status={doubanStatus} />
  ),
}))

vi.mock('@/components/admin/moderation/ModerationSourceBlock', () => ({
  ModerationSourceBlock: ({ sourceCheckStatus }: { sourceCheckStatus: string }) => (
    <div data-testid="source-block-mock" data-status={sourceCheckStatus} />
  ),
}))

vi.mock('@/components/admin/moderation/ModerationBasicInfoBlock', () => ({
  ModerationBasicInfoBlock: ({ video }: { video: { title: string; meta_score: number } }) => (
    <div data-testid="basic-info-block-mock">
      <span>{video.title}</span>
      <span>{`元数据 ${video.meta_score}%`}</span>
    </div>
  ),
}))

// ── 工厂 ────────────────────────────────────────────────────────

function makeVideoDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vid-1',
    title: '测试视频',
    type: 'movie',
    year: 2024,
    description: '这是简介',
    cover_url: null,
    review_status: 'pending_review',
    visibility_status: 'internal',
    created_at: '2026-03-20T00:00:00Z',
    douban_status: 'matched',
    source_check_status: 'ok',
    meta_score: 80,
    douban_id: 'db123',
    rating: 9.2,
    director: ['导演甲'],
    cast: ['演员甲'],
    genres: ['动作'],
    ...overrides,
  }
}

describe('ModerationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockImplementation(async (url: string) => {
      if (url === '/admin/videos/vid-1') {
        return { data: makeVideoDetail() }
      }
      // active sources for player
      if (url.startsWith('/admin/sources') && url.includes('status=active')) {
        return { data: [], total: 0 }
      }
      return { data: [], total: 0 }
    })
    postMock.mockResolvedValue({})
  })

  it('加载后显示视频标题和基础信息', async () => {
    render(<ModerationDetail videoId="vid-1" onReviewed={vi.fn()} />)
    await screen.findByText('测试视频')
    expect(screen.getByTestId('collapsible-basic')).toBeTruthy()
  })

  it('meta_score 显示在基础信息块', async () => {
    render(<ModerationDetail videoId="vid-1" onReviewed={vi.fn()} />)
    await screen.findByText('测试视频')
    expect(screen.getByText(/元数据 80%/)).toBeTruthy()
  })

  it('豆瓣折叠块默认展开，传入正确 status', async () => {
    render(<ModerationDetail videoId="vid-1" onReviewed={vi.fn()} />)
    await screen.findByText('测试视频')
    const block = screen.getByTestId('douban-block-mock')
    expect(block.getAttribute('data-status')).toBe('matched')
  })

  it('源健康折叠块默认展开，传入正确 status', async () => {
    render(<ModerationDetail videoId="vid-1" onReviewed={vi.fn()} />)
    await screen.findByText('测试视频')
    const block = screen.getByTestId('source-block-mock')
    expect(block.getAttribute('data-status')).toBe('ok')
  })

  it('播放器折叠块默认折叠（不渲染 player）', async () => {
    render(<ModerationDetail videoId="vid-1" onReviewed={vi.fn()} />)
    await screen.findByText('测试视频')
    expect(screen.queryByTestId('moderation-player-mock')).toBeNull()
  })

  it('点击播放器折叠块标题后展开 player', async () => {
    render(<ModerationDetail videoId="vid-1" onReviewed={vi.fn()} />)
    await screen.findByText('测试视频')
    fireEvent.click(screen.getByText('播放器预览'))
    await waitFor(() => {
      expect(screen.getByTestId('moderation-player-mock')).toBeTruthy()
    })
  })

  it('拒绝操作提交正确 body', async () => {
    const onReviewed = vi.fn()
    render(<ModerationDetail videoId="vid-1" onReviewed={onReviewed} />)
    await screen.findByText('测试视频')

    fireEvent.change(screen.getByTestId('moderation-reject-reason-input'), {
      target: { value: '片源错误' },
    })
    fireEvent.click(screen.getByTestId('moderation-reject-btn'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/videos/vid-1/review', {
        action: 'reject',
        reason: '片源错误',
      })
      expect(onReviewed).toHaveBeenCalledOnce()
    })
  })

  it('approve action keeps request body unchanged', async () => {
    render(<ModerationDetail videoId="vid-1" onReviewed={vi.fn()} />)
    await screen.findByText('测试视频')

    fireEvent.click(screen.getByTestId('moderation-approve-btn'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/videos/vid-1/review', { action: 'approve' })
    })
  })

  it('videoId 为 null 时显示空状态', () => {
    render(<ModerationDetail videoId={null} onReviewed={vi.fn()} />)
    expect(screen.getByTestId('moderation-detail-empty')).toBeTruthy()
  })

  it('点击快选预置原因追加到文本框', async () => {
    render(<ModerationDetail videoId="vid-1" onReviewed={vi.fn()} />)
    await screen.findByText('测试视频')
    fireEvent.click(screen.getByTestId('reject-preset-片源不完整'))
    const textarea = screen.getByTestId('moderation-reject-reason-input') as HTMLTextAreaElement
    expect(textarea.value).toBe('片源不完整')
  })
})
