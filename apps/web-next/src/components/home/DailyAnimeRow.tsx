'use client'

/**
 * DailyAnimeRow — 首页「每日放送」发现板块（ADR-189 D-189-7）
 *
 * 数据源：GET /home/daily-anime（Bangumi 当日 calendar 切片，**含未入站**）。
 * 独立发现机制（非 home-section / 非站内 video shelf）：
 *   - linkedVideo 命中 → 「站内可看」徽标 + 直链 watch
 *   - 未入站 → 「想看」徽标 + 链站内搜索引导
 * 布局仿 TopTenRow 水平滚动竖卡（2:3）。颜色全用 CSS 变量（零硬编码）。
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'

// ── 类型（镜像后端 /home/daily-anime 响应，web-next 侧声明）─────────────
interface DailyAnimeLinkedVideo {
  readonly videoId: string
  readonly slug: string | null
  readonly shortId: string
}
interface DailyAnimeItem {
  readonly bangumiSubjectId: string
  readonly title: string
  readonly nameCn: string | null
  readonly coverUrl: string | null
  readonly airWeekday: number
  readonly rating: number | null
  readonly rank: number
  readonly linkedVideo: DailyAnimeLinkedVideo | null
}
interface DailyAnimeResult {
  readonly weekday: number
  readonly items: DailyAnimeItem[]
}

const MIN_SLOTS = 4

interface DailyAnimeRowProps {
  readonly title: string
  readonly availableLabel: string
  readonly wishLabel: string
}

function watchHref(locale: string, lv: DailyAnimeLinkedVideo): string {
  const slug = lv.slug ? `${lv.slug}-${lv.shortId}` : lv.shortId
  return `/${locale}/watch/${slug}?ep=1`
}

function searchHref(locale: string, title: string): string {
  return `/${locale}/search?q=${encodeURIComponent(title)}`
}

function DailyAnimeCard({
  item,
  locale,
  availableLabel,
  wishLabel,
}: {
  readonly item: DailyAnimeItem
  readonly locale: string
  readonly availableLabel: string
  readonly wishLabel: string
}) {
  const linked = item.linkedVideo
  const href = linked ? watchHref(locale, linked) : searchHref(locale, item.title)
  const badge = linked ? availableLabel : wishLabel

  return (
    <Link
      href={href}
      data-daily-anime-card={item.bangumiSubjectId}
      data-linked={linked ? 'true' : 'false'}
      style={{
        width: 'var(--shelf-card-w-portrait)',
        flexShrink: 0,
        scrollSnapAlign: 'start',
        textDecoration: 'none',
        position: 'relative',
      }}
      className="group transition-opacity hover:opacity-90"
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '2/3',
          borderRadius: '8px',
          overflow: 'hidden',
          background: 'var(--bg-surface-sunken)',
        }}
      >
        {item.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverUrl}
            alt={item.title}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <span
          data-daily-anime-badge={linked ? 'available' : 'wish'}
          style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 600,
            color: linked ? 'var(--accent-fg, var(--fg-on-accent))' : 'var(--fg-default)',
            background: linked ? 'var(--accent-default)' : 'var(--bg-surface)',
            border: linked ? 'none' : '1px solid var(--border-default)',
          }}
        >
          {badge}
        </span>
      </div>
      <p
        style={{
          marginTop: '6px',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--fg-default)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.title}
      </p>
      <p style={{ fontSize: '12px', color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
        {item.rating == null ? '—' : `★ ${item.rating.toFixed(1)}`}
      </p>
    </Link>
  )
}

export function DailyAnimeRow({ title, availableLabel, wishLabel }: DailyAnimeRowProps) {
  const params = useParams()
  const locale = (params.locale as string) ?? 'en'
  const [items, setItems] = useState<DailyAnimeItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiClient
      .get<{ data: DailyAnimeResult }>('/home/daily-anime', { skipAuth: true })
      .then((res) => { if (!cancelled) setItems(res.data.items) })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // 无数据（calendar 未落库 / 抓取未跑）→ 不渲染板块（避免空区块占位）
  if (!loading && items.length === 0) return null

  return (
    <section data-testid="daily-anime-row">
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--fg-default)', letterSpacing: '-0.01em', marginBottom: '20px' }}>
        {title}
      </h2>
      <div
        data-daily-anime-track
        style={{
          display: 'flex',
          gap: 'var(--shelf-gap)',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          paddingBottom: 'var(--shelf-bottom-padding)',
        }}
      >
        {loading
          ? Array.from({ length: MIN_SLOTS }).map((_, i) => (
              <Skeleton key={i} shape="rect" style={{ width: 'var(--shelf-card-w-portrait)', flexShrink: 0, aspectRatio: '2/3' }} delay={i >= 2 ? 300 : undefined} />
            ))
          : items.map((item) => (
              <DailyAnimeCard key={item.bangumiSubjectId} item={item} locale={locale} availableLabel={availableLabel} wishLabel={wishLabel} />
            ))}
      </div>
    </section>
  )
}
