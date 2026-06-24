/**
 * related-videos.test.tsx — 详情页相关视频横滚（CARD-SIZE-A1-DETAIL / ADR-214 Amendment A1 D-214-A1-6）
 *
 * 覆盖 RelatedVideos 退役 60px 侧栏竖列表 → 全宽 ScrollRow 横滚 + VideoCard(navigate)：
 *   - loading → 横滚骨架（related-videos section，无 related-scroll）
 *   - items → ScrollRow related-scroll + N 个 VideoCard interaction=navigate
 *   - empty → 暂无相关推荐
 *   - 取数 URL：trending?type=&limit=12&exclude=（D-214-A1-6 仅相关、无加载更多）
 *
 * VideoCard 以 stub mock（聚焦 RelatedVideos 逻辑，避开 VideoCard 内部依赖）；ScrollRow 用真组件验证 a11y/包裹。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const getMock = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...args: unknown[]) => getMock(...args) },
}))

// VideoCard stub：data-interaction 暴露 navigate 变体断言
vi.mock('@/components/video/VideoCard', () => ({
  VideoCard: ({ video, interaction }: { video: { id: string; title: string }; interaction?: string }) => (
    <div data-testid="video-card" data-interaction={interaction}>
      {video.title}
    </div>
  ),
}))

import { RelatedVideos } from '../../../apps/web-next/src/components/detail/RelatedVideos'

const VIDEO = {
  id: 'v-1',
  type: 'movie',
} as never // RelatedVideos 仅用 id/type

const ITEMS = [
  { id: 'r1', title: '相关一', type: 'movie' },
  { id: 'r2', title: '相关二', type: 'movie' },
  { id: 'r3', title: '相关三', type: 'movie' },
]

beforeEach(() => {
  getMock.mockReset()
})

describe('RelatedVideos — 详情页相关视频横滚（D-214-A1-6）', () => {
  it('取数 URL：trending?type=&limit=12&exclude=（仅相关、无加载更多）', async () => {
    getMock.mockResolvedValueOnce({ data: ITEMS })
    render(<RelatedVideos video={VIDEO} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    const url = getMock.mock.calls[0]![0] as string
    expect(url).toContain('/videos/trending')
    expect(url).toContain('type=movie')
    expect(url).toContain('limit=12')
    expect(url).toContain('exclude=v-1')
  })

  it('items → ScrollRow related-scroll + N 个 VideoCard interaction=navigate', async () => {
    getMock.mockResolvedValueOnce({ data: ITEMS })
    render(<RelatedVideos video={VIDEO} />)
    await waitFor(() => expect(screen.getByTestId('related-scroll')).not.toBeNull())

    const cards = screen.getAllByTestId('video-card')
    expect(cards).toHaveLength(3)
    // navigate 变体（纯跳详情、不耦合播放器状态机）
    cards.forEach((c) => expect(c.getAttribute('data-interaction')).toBe('navigate'))
    // ScrollRow a11y：role=region + aria-label
    const scroll = screen.getByTestId('related-scroll')
    expect(scroll.getAttribute('role')).toBe('region')
    expect(scroll.getAttribute('aria-label')).toBe('相关推荐')
  })

  it('empty → 暂无相关推荐（无 related-scroll）', async () => {
    getMock.mockResolvedValueOnce({ data: [] })
    render(<RelatedVideos video={VIDEO} />)
    await waitFor(() => expect(screen.getByText('暂无相关推荐')).not.toBeNull())
    expect(screen.queryByTestId('related-scroll')).toBeNull()
  })

  it('取数失败 → 暂无相关推荐（非空 catch 降级）', async () => {
    getMock.mockRejectedValueOnce(new Error('net down'))
    render(<RelatedVideos video={VIDEO} />)
    await waitFor(() => expect(screen.getByText('暂无相关推荐')).not.toBeNull())
  })
})
