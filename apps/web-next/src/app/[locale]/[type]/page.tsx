import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageTransition } from '@/components/primitives/page-transition/PageTransition'
import { FilterArea } from '@/components/browse/FilterArea'
import { BrowseGrid } from '@/components/browse/BrowseGrid'
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

// ── 共享内容组件（允许 movie/anime/series/tvshow 目录静态路由复用） ─────────────

export async function CategoryPageContent({
  locale,
  type,
}: {
  locale: string
  type: string
}) {
  const videoType = VALID_TYPES[type]
  if (!videoType) notFound()

  const t = await getTranslations({ locale, namespace: 'nav' })

  // 分类标题映射
  const TYPE_LABELS: Record<string, string> = {
    movie:        t('catMovie'),
    series:       t('catSeries'),
    anime:        t('catAnime'),
    tvshow:       t('catVariety'),
    documentary:  t('catDocumentary'),
    short:        t('catShort'),
    sports:       t('catSports'),
    music:        t('catMusic'),
    news:         t('catNews'),
    kids:         t('catKids'),
    other:        t('catOther'),
  }

  const typeLabel = TYPE_LABELS[type] ?? type

  return (
    <PageTransition transitionKey={type} variant="sibling">
      {/* HANDOFF-15: max-w-page(1280px) + px-6(24px) + pt-8(32px) + pb-20(80px) — spec §12.1 */}
      <div
        className="max-w-page mx-auto w-full px-6"
        style={{ paddingTop: '32px', paddingBottom: '80px' }}
      >
        {/* 标题区 — spec §12.2 */}
        <div style={{ marginBottom: '24px' }}>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--fg-default)',
              letterSpacing: '-0.02em',
            }}
          >
            {typeLabel}
          </h1>
        </div>

        {/* 筛选区 — spec §12.3（锁定 type 维度，防止用户绕过分类路由） */}
        <div style={{ marginBottom: '24px' }}>
          <FilterArea lockedDims={['type']} />
        </div>

        {/* 网格 + 分页 — spec §12.4（initialType 强制覆盖 URL type 参数） */}
        <BrowseGrid initialType={videoType} />
      </div>
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
