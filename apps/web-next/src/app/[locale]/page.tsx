/**
 * HomePage — HANDOFF-22 对齐 docs/frontend_design_spec_20260423.md §10
 *
 * 结构（从上到下）：
 *   1. HeroBanner（全宽，height 520px）
 *   2. 主内容容器（max-w-feature，px-6，pt-block pb-20，section 间距 56px）
 *      a. 分类捷径（CategoryShortcutsClient）
 *      b. FeaturedRow（特色推荐，1.6fr + 3×1fr；无数据降级为趋势 Shelf）
 *      c. TopTenRow（TOP10 排行，水平滚动 + rank badge）
 *      d. ShelfRow — 热门电影
 *      e. ShelfRow — 热播剧集
 *      f. ShelfRow — 热门动漫
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
import { FeaturedRow } from '@/components/home/FeaturedRow'
import { TopTenRow } from '@/components/home/TopTenRow'

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

        {/* 精选推荐区：1.6fr + 3×1fr 网格，有运营数据时精选，无则趋势填位 */}
        <FeaturedRow
          title={t('featured')}
          viewAllLabel={t('viewAll')}
        />

        {/* TOP10 排行 — 水平滚动竖版卡片 + rank badge */}
        <TopTenRow
          title={t('topTen')}
          viewAllLabel={t('viewAll')}
        />

        {/* 趋势影片 — poster-row */}
        <ShelfRow
          template="poster-row"
          query="type=movie&period=week&limit=10"
          title={t('trendingMovies')}
          viewAllHref={`/${locale}/movie`}
          viewAllLabel={t('viewAll')}
          data-testid="movie-grid"
        />

        {/* 趋势剧集 — poster-row */}
        <ShelfRow
          template="poster-row"
          query="type=series&period=week&limit=8"
          title={t('trendingSeries')}
          viewAllHref={`/${locale}/series`}
          viewAllLabel={t('viewAll')}
          data-testid="series-grid"
        />

        {/* 热门动漫 — poster-row */}
        <ShelfRow
          template="poster-row"
          query="type=anime&period=week&limit=8"
          title={t('trendingAnime')}
          viewAllHref={`/${locale}/anime`}
          viewAllLabel={t('viewAll')}
          data-testid="anime-grid"
        />
      </div>
    </>
  )
}
