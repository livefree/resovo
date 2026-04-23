import { notFound } from 'next/navigation'
import { PageTransition } from '@/components/primitives/page-transition/PageTransition'
import { VideoGrid } from '@/components/video/VideoGrid'
import type { VideoType } from '@resovo/types'

// ── 类型映射 ──────────────────────────────────────────────────────────────────

// tvshow maps to VideoType 'variety' (ADR-048 §4, aligned with video-route.ts)
const VALID_TYPES: Record<string, VideoType> = {
  movie:        'movie',
  series:       'series',
  anime:        'anime',
  tvshow:       'variety',
  documentary:  'documentary',
  short:        'short',
  sports:       'sports',
  music:        'music',
  news:         'news',
  kids:         'kids',
  other:        'other',
}

// UI-REBUILD（2026-04-23）修订：
//   - 删除页面内 NAV_TABS + TopSlot 的二级分类标签栏（和新 Nav 功能重叠 →
//     用户反馈"新旧两套共存"）
//   - 分类切换由全局 Nav 承载（MAIN_CATEGORIES + "更多 ▼"）

// ── 共享内容组件（允许 movie/anime/series/tvshow 目录静态路由复用） ─────────────

export async function CategoryPageContent({
  locale: _locale,
  type,
}: {
  locale: string
  type: string
}) {
  const videoType = VALID_TYPES[type]
  if (!videoType) notFound()

  return (
    <PageTransition transitionKey={type} variant="sibling">
      <section className="max-w-screen-xl mx-auto w-full px-4 py-6">
        <VideoGrid
          query={`type=${videoType}&limit=40`}
          variant="portrait"
          layout="grid"
          stagger
          data-testid={`category-grid-${type}`}
        />
      </section>
    </PageTransition>
  )
}

// ── 页面 ──────────────────────────────────────────────────────────────────────

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; type: string }>
}) {
  const { locale, type } = await params
  return CategoryPageContent({ locale, type })
}
