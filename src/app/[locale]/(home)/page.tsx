/**
 * /(home)/page.tsx — 首页
 * Hero Banner + 分类标签 + 热门电影网格 + 热播剧集宽卡 + 底部声明
 */

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Nav } from '@/components/layout/Nav'
import { HeroBanner } from '@/components/video/HeroBanner'
import { VideoGrid } from '@/components/video/VideoGrid'

// ── 首页 ──────────────────────────────────────────────────────────

export default function HomePage() {
  const t = useTranslations('home')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Nav />

      {/* Hero Banner */}
      <HeroBanner />

      {/* 主体内容 */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-8 space-y-12">
        {/* 热门电影 */}
        <section aria-label={t('trendingMovies')}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
              {t('trendingMovies')}
            </h2>
            <Link
              href="/browse?type=movie"
              className="text-sm hover:opacity-80 transition-opacity"
              style={{ color: 'var(--gold)' }}
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

        {/* 热播剧集 */}
        <section aria-label={t('trendingSeries')}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
              {t('trendingSeries')}
            </h2>
            <Link
              href="/browse?type=series"
              className="text-sm hover:opacity-80 transition-opacity"
              style={{ color: 'var(--gold)' }}
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
      </main>

      {/* 底部免责声明 */}
      <footer
        className="border-t py-6 text-center text-xs px-4"
        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        data-testid="footer-disclaimer"
      >
        {t('disclaimer')}
      </footer>
    </div>
  )
}
