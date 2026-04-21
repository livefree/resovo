import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { PageTransition } from '@/components/primitives/page-transition/PageTransition'
import { VideoGrid } from '@/components/video/VideoGrid'
import { TopSlot } from '@/components/layout/TopSlot'
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
}

const NAV_TABS: Array<{ slug: string; i18nKey: string }> = [
  { slug: 'movie',       i18nKey: 'catMovie' },
  { slug: 'series',      i18nKey: 'catSeries' },
  { slug: 'anime',       i18nKey: 'catAnime' },
  { slug: 'tvshow',      i18nKey: 'catVariety' },
  { slug: 'documentary', i18nKey: 'catDocumentary' },
]

// ── 页面 ──────────────────────────────────────────────────────────────────────

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; type: string }>
}) {
  const { locale, type } = await params

  const videoType = VALID_TYPES[type]
  if (!videoType) notFound()

  const t = await getTranslations({ locale, namespace: 'nav' })

  return (
    <PageTransition transitionKey={type} variant="sibling">
      <TopSlot>
        <nav
          aria-label="分类导航"
          className="max-w-screen-xl mx-auto w-full px-4 pt-4 pb-2 flex items-center gap-1 overflow-x-auto scrollbar-none"
        >
          {NAV_TABS.map((tab) => {
            const isActive = tab.slug === type
            return (
              <Link
                key={tab.slug}
                href={`/${locale}/${tab.slug}`}
                aria-current={isActive ? 'page' : undefined}
                className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                style={
                  isActive
                    ? {
                        background: 'var(--accent-default)',
                        color: 'var(--accent-fg)',
                      }
                    : {
                        background: 'var(--bg-surface)',
                        color: 'var(--fg-muted)',
                        border: '1px solid var(--border-default)',
                      }
                }
              >
                {t(tab.i18nKey as Parameters<typeof t>[0])}
              </Link>
            )
          })}
        </nav>
      </TopSlot>

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
