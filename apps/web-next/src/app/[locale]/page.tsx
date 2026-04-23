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
import Link from 'next/link'
import { HeroBanner } from '@/components/video/HeroBanner'
import { VideoGrid } from '@/components/video/VideoGrid'

// ── 分类捷径 icon SVG（5 种主分类）────────────────────────────────────────────

function MovieIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="20" x="2" y="2" rx="2" />
      <line x1="7" x2="7" y1="2" y2="22" /><line x1="17" x2="17" y1="2" y2="22" />
      <line x1="2" x2="22" y1="12" y2="12" />
      <line x1="2" x2="7" y1="7" y2="7" /><line x1="17" x2="22" y1="7" y2="7" />
      <line x1="2" x2="7" y1="17" y2="17" /><line x1="17" x2="22" y1="17" y2="17" />
    </svg>
  )
}

function SeriesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="15" rx="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  )
}

function AnimeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function VarietyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
    </svg>
  )
}

function DocumentaryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

// ── 分类捷径卡片数据 ───────────────────────────────────────────────────────────

const CATEGORY_SHORTCUTS = [
  { typeParam: 'movie',       labelKey: 'catMovie'       as const, Icon: MovieIcon },
  { typeParam: 'series',      labelKey: 'catSeries'      as const, Icon: SeriesIcon },
  { typeParam: 'anime',       labelKey: 'catAnime'       as const, Icon: AnimeIcon },
  { typeParam: 'tvshow',      labelKey: 'catVariety'     as const, Icon: VarietyIcon },
  { typeParam: 'documentary', labelKey: 'catDocumentary' as const, Icon: DocumentaryIcon },
] as const

// ── 分类捷径组件（Server Component）────────────────────────────────────────────

interface CategoryShortcutsProps {
  readonly locale: string
  readonly tNav: (key: string) => string
}

function CategoryShortcuts({ locale, tNav }: CategoryShortcutsProps) {
  return (
    <section aria-label="分类捷径">
      {/* repeat(5,1fr) 网格，gap 12px — spec §10.4 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '12px',
        }}
      >
        {CATEGORY_SHORTCUTS.map(({ typeParam, labelKey, Icon }) => (
          <Link
            key={typeParam}
            href={`/${locale}/${typeParam}`}
            data-testid={`category-shortcut-${typeParam}`}
            className="flex flex-col items-center transition-colors group"
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              textDecoration: 'none',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              gap: '12px',
            }}
            onMouseEnter={undefined}
          >
            {/* 图标盒 44px — spec §10.4 */}
            <span
              aria-hidden="true"
              className="flex items-center justify-center"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'var(--accent-muted)',
                color: 'var(--accent-default)',
                flexShrink: 0,
              }}
            >
              <Icon />
            </span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--fg-muted)',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {tNav(labelKey)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ── HomePage ──────────────────────────────────────────────────────────────────

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'home' })
  const tNav = await getTranslations({ locale, namespace: 'nav' })

  return (
    <>
      <HeroBanner />

      {/* 主内容容器（spec §10.3）：max-w-feature 1200px，px-6 24px，pt-block 48px，pb 80px，section gap 56px */}
      <div
        className="max-w-feature mx-auto w-full px-6 flex flex-col"
        style={{
          paddingTop: 'var(--page-block-gap)',     // 48px
          paddingBottom: 'var(--space-20)',        // 80px
          gap: 'var(--page-section-gap)',          // 56px
        }}
      >
        {/* 分类捷径（spec §10.4） */}
        <CategoryShortcuts locale={locale} tNav={tNav} />

        {/* 趋势影片 */}
        <section aria-label={t('trendingMovies')}>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 'var(--page-inline-gap)' }}
          >
            <h2
              style={{ fontSize: '18px', fontWeight: 700, color: 'var(--fg-default)', letterSpacing: '-0.01em' }}
            >
              {t('trendingMovies')}
            </h2>
            <Link
              href={`/${locale}/movie`}
              className="transition-opacity hover:opacity-70"
              style={{ fontSize: '13px', color: 'var(--accent-default)', textDecoration: 'none', fontWeight: 500 }}
            >
              {t('viewAll')} →
            </Link>
          </div>
          <VideoGrid
            query="type=movie&period=week&limit=10"
            variant="portrait"
            layout="scroll"
            data-testid="movie-grid"
          />
        </section>

        {/* 趋势剧集 */}
        <section aria-label={t('trendingSeries')}>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 'var(--page-inline-gap)' }}
          >
            <h2
              style={{ fontSize: '18px', fontWeight: 700, color: 'var(--fg-default)', letterSpacing: '-0.01em' }}
            >
              {t('trendingSeries')}
            </h2>
            <Link
              href={`/${locale}/series`}
              className="transition-opacity hover:opacity-70"
              style={{ fontSize: '13px', color: 'var(--accent-default)', textDecoration: 'none', fontWeight: 500 }}
            >
              {t('viewAll')} →
            </Link>
          </div>
          <VideoGrid
            query="type=series&period=week&limit=8"
            variant="landscape"
            layout="scroll"
            data-testid="series-grid"
          />
        </section>
      </div>
    </>
  )
}
