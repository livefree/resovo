'use client'

/**
 * FeaturedRow — 首页精选推荐区块（HANDOFF-22）
 *   （CARD-SIZE-SYSTEM / ADR-214 Amendment A2：1.6fr 异宽 → CardGrid global 全站等宽网格归一）
 *
 * 数据源：GET /home/modules?slot=featured → HomeModule[]
 * 布局：CardGrid global 档全站等宽网格（DB 注入全局 --card-w / --card-gap，auto-fill 精确定宽 +
 *       居中留白，D-214-A2-2）。归一前为 1.6fr+3×1fr 首列大卡异宽。
 *
 * 策略：
 *   - Section 始终以"精选推荐"身份渲染，不替换为其他 section
 *   - 无运营模块时：以趋势视频填充 grid（保持标题与布局不变）
 *   - 有运营模块时：显示编辑精选内容（当前仍以趋势填位，TODO: 待后端实现）
 *   - loading 时：FeaturedGridSkeleton（CardGrid global 骨架，无闪烁）
 *
 * TODO(featured-videos-endpoint): 待后端实现 /home/featured-videos 批量端点（类似 /home/top10）
 * 以返回运营选定的 VideoCard 列表，替换当前趋势视频填位逻辑。
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { CardGrid } from '@/components/shared/card-grid/CardGrid'
import { VideoCard } from '@/components/video/VideoCard'
import { useBrand } from '@/hooks/useBrand'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import type { HomeModule, VideoCard as VideoCardType, ApiResponse } from '@resovo/types'

// 精选展示槽位：JS 侧取数/骨架上限（A2 列数由容器宽/卡宽派生，此为内容条数上限非列数）。
const FEATURED_SLOTS = 5

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeaturedRowProps {
  readonly title: string
  readonly viewAllHref?: string
  readonly viewAllLabel?: string
}

// ── 子组件 ────────────────────────────────────────────────────────────────────

function RowHeader({
  title,
  viewAllHref,
  viewAllLabel,
}: {
  readonly title: string
  readonly viewAllHref?: string
  readonly viewAllLabel?: string
}) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color: 'var(--fg-default)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      {viewAllHref && viewAllLabel && (
        <Link
          href={viewAllHref}
          className="transition-opacity hover:opacity-70"
          style={{
            fontSize: '13px',
            color: 'var(--accent-default)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          {viewAllLabel} →
        </Link>
      )}
    </div>
  )
}

function FeaturedGridSkeleton() {
  return (
    <CardGrid sizeClass="global">
      {Array.from({ length: FEATURED_SLOTS }).map((_, i) => (
        <Skeleton
          key={i}
          shape="rect"
          style={{ aspectRatio: '2/3' }}
          delay={i >= 2 ? 300 : undefined}
        />
      ))}
    </CardGrid>
  )
}

function FeaturedGrid({ videos }: { readonly videos: VideoCardType[] }) {
  // 等宽 standard 网格：minmax(0,1fr) + CardGrid `> * { min-width:0 }` 结构上消除挤垮，
  // 故无需归一前的 sparse-fill 空占位（占位机制亦与 DB 可配列数不兼容）。卡 <列数 时末行自然留空。
  return (
    <CardGrid sizeClass="global" data-testid="featured-grid">
      {videos.slice(0, FEATURED_SLOTS).map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </CardGrid>
  )
}

// ── FeaturedRow ───────────────────────────────────────────────────────────────

export function FeaturedRow({ title, viewAllHref, viewAllLabel }: FeaturedRowProps) {
  const { brand } = useBrand()
  const [videos, setVideos] = useState<VideoCardType[]>([])
  const [loading, setLoading] = useState(true)

  // CHG-SN-8-GAPS-HOME-BRAND-MULTI / ADR-052：modules 查询按 brand 过滤
  useEffect(() => {
    setLoading(true)
    const modulesUrl = brand.slug
      ? `/home/modules?slot=featured&brand_slug=${encodeURIComponent(brand.slug)}`
      : '/home/modules?slot=featured'
    Promise.all([
      apiClient.get<ApiResponse<HomeModule[]>>(modulesUrl, { skipAuth: true }),
      apiClient.get<{ data: VideoCardType[] }>(`/videos/trending?period=week&limit=${FEATURED_SLOTS}`, { skipAuth: true }),
    ])
      .then(([_modulesRes, trendingRes]) => {
        // TODO(featured-videos-endpoint): 当 _modulesRes.data.length > 0 时
        // 改用精选端点返回的 VideoCard 列表替换 trendingRes
        setVideos(trendingRes.data)
      })
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }, [brand.slug])

  return (
    <section>
      <RowHeader title={title} viewAllHref={viewAllHref} viewAllLabel={viewAllLabel} />
      {loading ? <FeaturedGridSkeleton /> : <FeaturedGrid videos={videos} />}
    </section>
  )
}
