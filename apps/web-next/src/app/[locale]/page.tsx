import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { HeroBanner } from '@/components/video/HeroBanner'
import { VideoGrid } from '@/components/video/VideoGrid'

export default function HomePage() {
  const t = useTranslations('home')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Nav />

      <HeroBanner />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-8 space-y-12">
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

      <Footer />
    </div>
  )
}
