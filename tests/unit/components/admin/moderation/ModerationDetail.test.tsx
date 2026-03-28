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

describe('ModerationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockImplementation(async (url: string) => {
      if (url === '/admin/videos/vid-1') {
        return {
          data: {
            id: 'vid-1',
            title: '测试视频',
            type: 'movie',
            year: 2024,
            description: 'desc',
            cover_url: null,
            review_status: 'pending_review',
            visibility_status: 'internal',
            created_at: '2026-03-20T00:00:00Z',
          },
        }
      }
      if (url === '/admin/sources?videoId=vid-1&status=active&page=1&limit=1') {
        return {
          data: [{ id: 'src-1', source_url: 'https://cdn.example.com/v1.m3u8', source_name: 'main', is_active: true }],
          total: 1,
        }
      }
      return { data: [], total: 0 }
    })
    postMock.mockResolvedValue({})
  })

  it('submits reject reason to review endpoint', async () => {
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
})

