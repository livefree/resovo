import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { HeroV2 } from '@/components/video/HeroV2'
import { VideoGrid } from '@/components/video/VideoGrid'

export default function HomePage() {
  const t = useTranslations('home')

  return (
    <>
      <HeroV2 />

      <div className="max-w-screen-xl mx-auto w-full px-4 py-8 space-y-12">
        <section aria-label={t('trendingMovies')}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ color: 'var(--fg-default)' }}>
              {t('trendingMovies')}
            </h2>
            <Link
              href="/browse?type=movie"
              className="text-sm hover:opacity-80 transition-opacity"
              style={{ color: 'var(--accent-default)' }}
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

        <section aria-label={t('trendingSeries')}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ color: 'var(--fg-default)' }}>
              {t('trendingSeries')}
            </h2>
            <Link
              href="/browse?type=series"
              className="text-sm hover:opacity-80 transition-opacity"
              style={{ color: 'var(--accent-default)' }}
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
