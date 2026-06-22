/**
 * tests/unit/web-next/DailyAnimeRow.test.tsx
 * CHG-BNG-HOME-WIRE-5B（ADR-189 D-189-7）：首页每日放送发现板块
 *   - linked → 站内可看徽标 + watch deeplink；未入站 → 想看徽标 + 站内搜索引导
 *   - 空数据 → 板块自隐（不渲染）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock('next/navigation', () => ({ useParams: () => ({ locale: 'en' }) }))
vi.mock('@/components/primitives/feedback/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}))

const mockGet = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

import { DailyAnimeRow } from '@/components/home/DailyAnimeRow'

const LABELS = { title: '每日放送', availableLabel: '站内可看', wishLabel: '想看' }

function mkItem(over: Record<string, unknown> = {}) {
  return {
    bangumiSubjectId: '326125', title: '葬送的芙莉莲', nameCn: '葬送的芙莉莲',
    coverUrl: 'https://lain.bgm.tv/p.jpg', airWeekday: 1, rating: 9.1, rank: 0,
    linkedVideo: null, ...over,
  }
}

beforeEach(() => { mockGet.mockReset() })

describe('DailyAnimeRow', () => {
  it('linked → 站内可看徽标 + watch deeplink；未入站 → 想看徽标 + 搜索引导', async () => {
    mockGet.mockResolvedValue({
      data: {
        weekday: 1,
        items: [
          mkItem({ bangumiSubjectId: '1', title: '芙莉莲', linkedVideo: { videoId: 'v1', slug: 'frieren', shortId: 'ab12' } }),
          mkItem({ bangumiSubjectId: '2', title: '某新番', linkedVideo: null }),
        ],
      },
    })
    render(<DailyAnimeRow {...LABELS} />)

    await waitFor(() => expect(screen.getByTestId('daily-anime-row')).not.toBeNull())
    // 调公开端点
    expect(mockGet).toHaveBeenCalledWith('/home/daily-anime', { skipAuth: true })

    const linked = screen.getByText('芙莉莲').closest('a')!
    expect(linked.getAttribute('href')).toBe('/en/watch/frieren-ab12?ep=1')
    expect(linked.querySelector('[data-daily-anime-badge="available"]')?.textContent).toBe('站内可看')

    const wish = screen.getByText('某新番').closest('a')!
    expect(wish.getAttribute('href')).toBe('/en/search?q=%E6%9F%90%E6%96%B0%E7%95%AA')
    expect(wish.querySelector('[data-daily-anime-badge="wish"]')?.textContent).toBe('想看')
  })

  it('空数据 → 板块自隐（不渲染 daily-anime-row）', async () => {
    mockGet.mockResolvedValue({ data: { weekday: 1, items: [] } })
    render(<DailyAnimeRow {...LABELS} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByTestId('daily-anime-row')).toBeNull())
  })

  it('取数失败 → 板块自隐（catch 降级空）', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    render(<DailyAnimeRow {...LABELS} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByTestId('daily-anime-row')).toBeNull())
  })

  it('IMGH-P3-4D：封面走 SafeImage（coverUrl=null → FallbackCover role=img，无裸 img 裂图）', async () => {
    mockGet.mockResolvedValue({
      data: { weekday: 1, items: [mkItem({ bangumiSubjectId: '9', title: '无封面番', coverUrl: null })] },
    })
    const { container } = render(<DailyAnimeRow {...LABELS} />)
    await waitFor(() => expect(container.querySelector('[data-daily-anime-card="9"]')).not.toBeNull())
    const card = container.querySelector('[data-daily-anime-card="9"]')!
    // src 空 → SafeImage 渲染 FallbackCover（role="img" 兜底），而非裸 <img src> 裂图
    expect(card.querySelector('[role="img"]')).not.toBeNull()
  })

  it('linked 无 slug → watch deeplink 仅 shortId', async () => {
    mockGet.mockResolvedValue({
      data: { weekday: 1, items: [mkItem({ bangumiSubjectId: '3', title: 'X', linkedVideo: { videoId: 'v', slug: null, shortId: 'zz99' } })] },
    })
    render(<DailyAnimeRow {...LABELS} />)
    await waitFor(() => expect(screen.getByTestId('daily-anime-row')).not.toBeNull())
    expect(screen.getByText('X').closest('a')!.getAttribute('href')).toBe('/en/watch/zz99?ep=1')
  })
})
