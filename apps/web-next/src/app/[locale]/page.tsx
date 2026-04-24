/**
 * HomePage — HANDOFF-13 对齐 docs/frontend_design_spec_20260423.md §10
 *
 * 结构（从上到下）：
 *   1. HeroBanner（全宽，height 520px，内容容器 max-w-feature px-6 pb-14）
 *   2. 主内容容器（max-w-feature，px-6，pt-block pb-20，section 间距 56px）
 *      a. 分类捷径（repeat(5,1fr) 网格，卡片 padding 16px 18px，图标盒 44px）
 *      b. 趋势影片 VideoGrid row（portrait scroll）
 *      c. 趋势剧集 VideoGrid row（landscape scroll）
 *
 * Token 消费（spec §10.3）：
 *   容器 max-width → max-w-feature      var(--layout-feature-max) 1200px
 *   左右 inset     → px-6               var(--space-6) = 24px
 *   顶部 padding   → var(--page-block-gap)    48px
 *   底部 padding   → var(--space-20)          80px
 *   section 间距   → var(--page-section-gap)  56px
 */

import { getTranslations } from 'next-intl/server'
import { HeroBanner } from '@/components/video/HeroBanner'
import { ShelfRow } from '@/components/video/Shelf'
import { CategoryShortcutsClient } from '@/components/home/CategoryShortcutsClient'

// ── HomePage ──────────────────────────────────────────────────────────────────

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'home' })

  return (
    <>
      <HeroBanner />

      {/* 主内容容器（spec §10.3）：max-w-feature 1200px，px-6 24px，pt-block 48px，pb 80px，section gap 56px */}
      <div
        className="max-w-feature mx-auto w-full px-6 flex flex-col"
        style={{
          paddingTop: 'var(--page-block-gap)',
          paddingBottom: 'var(--space-20)',
          gap: 'var(--page-section-gap)',
        }}
      >
        {/* 分类捷径（Client Component，mount 后加载数量角标） */}
        <CategoryShortcutsClient />

        {/* 趋势影片 — poster-row */}
        <ShelfRow
          template="poster-row"
          query="type=movie&period=week&limit=10"
          title={t('trendingMovies')}
          viewAllHref={`/${locale}/movie`}
          viewAllLabel={t('viewAll')}
          data-testid="movie-grid"
        />

        {/* 趋势剧集 — poster-row（统一竖版，HANDOFF-20） */}
        <ShelfRow
          template="poster-row"
          query="type=series&period=week&limit=8"
          title={t('trendingSeries')}
          viewAllHref={`/${locale}/series`}
          viewAllLabel={t('viewAll')}
          data-testid="series-grid"
        />
      </div>
    </>
  )
}
