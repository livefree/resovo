'use client'

/**
 * SearchResultRow — 搜索结果列表行（列表布局：封面 2:3 + 信息区 + CTA）
 *
 * 从 SearchPage 提取（SEARCH-FE-4）供两处复用：
 *   - 搜索结果区（带 highlight 高亮）
 *   - 无结果态「你可能想看」推荐区（trending VideoCard 直接可喂——SearchResult extends VideoCard，
 *     highlight 可选，无高亮时退化为普通标题）
 *
 * Token 消费（frontend_design_spec §13.2）：封面 var(--search-result-cover-w) / 间距 var(--search-result-*)。
 */

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { SafeImage } from '@/components/media'
import { ChipType } from '@/components/primitives/chip-type'
import { parseHighlight } from '@/lib/parse-highlight'
import { getVideoDetailHref } from '@/lib/video-route'
import type { SearchResult } from '@resovo/types'

export interface SearchResultRowProps {
  result: SearchResult
  locale: string
}

export function SearchResultRow({ result, locale }: SearchResultRowProps) {
  const t = useTranslations('search')
  const detailHref = getVideoDetailHref(result)
  const watchSlug = result.slug ? `${result.slug}-${result.shortId}` : result.shortId
  const watchHref = `/${locale}/watch/${watchSlug}?ep=1`

  const displayTitle = result.highlight?.title
    ? parseHighlight(result.highlight.title)
    : result.title

  return (
    <article
      data-testid="search-result-row"
      style={{
        display: 'flex',
        gap: 'var(--search-result-padding)',
        padding: 'var(--search-result-padding)',
        borderRadius: 'var(--radius-base)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* 封面 */}
      <Link href={detailHref} style={{ flexShrink: 0, display: 'block' }}>
        <div
          style={{
            width: 'var(--search-result-cover-w)',
            aspectRatio: '2/3',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          <SafeImage
            src={result.coverUrl ?? undefined}
            blurHash={result.posterBlurhash ?? undefined}
            aspect="2:3"
            width={120}
            height={180}
            alt={result.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      </Link>

      {/* 信息区 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* 标题（含高亮） */}
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--fg-default)',
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {displayTitle}
          {result.titleEn && (
            <span
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 400,
                color: 'var(--fg-muted)',
                marginTop: '2px',
              }}
            >
              {result.titleEn}
            </span>
          )}
        </h3>

        {/* meta 行：类型 Chip + 年份 + 评分 */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <ChipType type={result.type} size="sm" />
          {result.year && (
            <span style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>{result.year}</span>
          )}
          {result.rating !== null && (
            <span style={{ fontSize: '13px', color: 'var(--gold)', fontWeight: 500 }}>
              ★ {result.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* CTA 按钮 */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--search-cta-gap)',
            marginTop: 'auto',
            paddingTop: '4px',
          }}
        >
          <Link
            href={watchHref}
            data-testid="search-row-watch"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-default)',
              color: 'var(--fg-on-accent)',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            {t('watchNow')}
          </Link>
          <Link
            href={detailHref}
            data-testid="search-row-detail"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--fg-default)',
              fontSize: '13px',
              fontWeight: 400,
              textDecoration: 'none',
            }}
          >
            {t('details')}
          </Link>
        </div>
      </div>
    </article>
  )
}
