/**
 * detail-hero-line-names.test.tsx — BUGFIX-WATCH-EP-URL ③
 *
 * 详情页线路名须与播放页一致：DetailHero 走 buildLineMatrix + buildThemedLines（真实纯函数）
 * + 用户主题（useRouteTheme），渲染主题化线路名（立春/雨水…）而非原始 siteDisplayName。
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))
vi.mock('next-intl', () => ({ useLocale: () => 'zh-CN' }))

const THEME = { id: 'jie_qi', displayName: '节气', labels: ['立春', '雨水', '惊蛰'], deadLabel: '已断', fallbackPrefix: '线路' }
vi.mock('@/lib/route-theme-storage', () => ({
  useRouteTheme: () => ({ theme: THEME }),
}))

vi.mock('@/stores/playerStore', () => {
  const state = { enter: vi.fn() }
  const usePlayerStore = (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state)
  return { usePlayerStore }
})

vi.mock('@/components/search/MetaChip', () => ({ MetaChip: () => null }))
vi.mock('@/components/media', () => ({ SafeImage: () => null }))
vi.mock('@/components/primitives/shared-element/SharedElement', () => ({
  SharedElement: { Target: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> },
}))
vi.mock('@/components/primitives/breadcrumb/Breadcrumb', () => ({ Breadcrumb: () => null }))
vi.mock('@/components/primitives/feedback/Skeleton', () => ({ Skeleton: () => null }))
vi.mock('@/lib/report-broken-image', () => ({ reportBrokenImage: vi.fn() }))
vi.mock('@/lib/admin-preview-query', () => ({ carryAdminPreview: (url: string) => url }))
vi.mock('@/lib/categories', () => ({ ALL_CATEGORIES: [] }))

import { render, screen, cleanup } from '@testing-library/react'
import { DetailHero } from '../../../apps/web-next/src/components/detail/DetailHero'
import type { Video, VideoSource } from '@resovo/types'

const MOCK_VIDEO: Video = {
  id: 'uuid-1',
  shortId: 'aB3kR9x1',
  slug: 'test-slug',
  title: '测试视频',
  titleEn: null,
  titleOriginal: null,
  type: 'series',
  year: 2026,
  country: 'CN',
  rating: 8.5,
  ratingVotes: 100,
  episodeCount: 3,
  runtimeMinutes: null,
  coverUrl: null,
  posterBlurhash: null,
  description: '测试',
  genres: [],
  director: [],
  cast: [],
  writers: [],
  aliases: [],
  languages: [],
  tags: [],
  subtitleLangs: [],
  status: 'completed',
} as unknown as Video

function makeSource(site: string, name: string, score: number, quality: string): VideoSource {
  return {
    id: `${name}-id`,
    videoId: 'uuid-1',
    sourceUrl: `https://example.com/${name}.m3u8`,
    sourceName: name,
    siteDisplayName: site,
    quality,
    type: 'hls',
    episodeNumber: 1,
    isActive: true,
    effectiveScore: score,
    audioLanguage: null,
  } as unknown as VideoSource
}

// 两条不同线路（buildLineKey 不同）
const MOCK_SOURCES = [
  makeSource('量子资源', 'line1', 0.8, '1080P'),
  makeSource('暴风资源', 'line2', 0.7, '720P'),
]

describe('DetailHero 线路名 — BUGFIX-WATCH-EP-URL ③', () => {
  afterEach(() => cleanup())

  it('渲染主题化线路名（立春/雨水），非原始 siteDisplayName', () => {
    render(<DetailHero video={MOCK_VIDEO} episode={1} sources={MOCK_SOURCES} />)
    const btn0 = screen.getByTestId('detail-line-btn-0')
    const btn1 = screen.getByTestId('detail-line-btn-1')
    expect(btn0.textContent).toContain('立春')
    expect(btn1.textContent).toContain('雨水')
    // 主题模式追加画质
    expect(btn0.textContent).toContain('1080P')
    // 不再出现原始站点名
    expect(btn0.textContent).not.toContain('量子资源')
    expect(btn1.textContent).not.toContain('暴风资源')
  })

  it('无可用源 → 不渲染线路选择器', () => {
    render(<DetailHero video={MOCK_VIDEO} episode={1} sources={[]} />)
    expect(screen.queryByTestId('detail-line-btn-0')).toBeNull()
  })
})
