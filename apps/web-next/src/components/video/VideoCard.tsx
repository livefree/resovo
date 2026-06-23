'use client'

/**
 * VideoCard — 前台视频卡片（共享组件，ADR-214 D-214-7 interaction 变体）
 *
 * 两交互模式（外壳按 `interaction` 分流两独立内部组件）：
 *   - `takeover`（默认）：首页 / 搜索 / Shelf 体验——海报点击 Fast Takeover 直达播放器
 *     （保留 usePlayerStore / useRouter / FloatingPlayButton），标题独立链到详情页（双出口）。
 *   - `navigate`：分类 / 搜索 / 相关页——整卡 <Link> 纯跳转详情页，**严禁 usePlayerStore /
 *     useRouter takeover hook、不渲染 FloatingPlayButton（避免误导"播放"可供性）**（D-214-7 P2）。
 *
 * 默认 `takeover` → 现有消费方（TopTenRow / FeaturedRow / Shelf / VideoGrid）零行为变更。
 * navigate 本卡仅建不接；BrowseGrid 切换归 CARD-SIZE-BROWSE-MIGRATE（过渡期 BrowseCard / browse-card testid 保持）。
 */

import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getVideoDetailHref } from '@/lib/video-route'
import { reportBrokenImage } from '@/lib/report-broken-image'
import { usePlayerStore } from '@/stores/playerStore'
import { FloatingPlayButton } from './FloatingPlayButton'
import { StackedPosterFrame } from '@/components/primitives/media/StackedPosterFrame'
import { TagLayer } from '@/components/primitives/media/TagLayer'
import { videoCardToTagProps } from '@/lib/tag-mapping'
import { getStackLevel } from '@/lib/video-stack-level'
import type { VideoCard as VideoCardType } from '@resovo/types'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'

export type VideoCardInteraction = 'takeover' | 'navigate'

interface VideoCardProps {
  video: VideoCardType
  /** 交互模式，默认 'takeover'（现有消费方零行为变更，D-214-7） */
  interaction?: VideoCardInteraction
  className?: string
}

// ── 共享子件（两交互分支复用，takeover DOM 逐字保留防回归）─────────────────────

/** 海报视觉基底（StackedPosterFrame）。两分支共用；交互层由各分支在外层 group/poster 内自拼。 */
function VideoCardCover({ video }: { video: VideoCardType }) {
  return (
    <StackedPosterFrame
      src={video.coverUrl}
      alt={video.title}
      width={200}
      height={300}
      aspect="2:3"
      blurHash={video.posterBlurhash ?? undefined}
      fallback={{ title: video.title, type: video.type, seed: video.id }}
      onLoadFail={({ src }) =>
        reportBrokenImage({ videoId: video.id, imageKind: 'poster', url: src })
      }
      stackLevel={getStackLevel(video.type)}
      className="w-full"
    />
  )
}

/**
 * 海报 hover 暗化遮罩（两分支共用，纯视觉 pointer-events-none，依赖父级 group/poster）。
 * 技术债：沿用既有 `bg-black/40` Tailwind 字面色以保 takeover DOM 逐字一致；token 化留待后续 token 卡。
 */
function PosterHoverDim() {
  return (
    <div className="absolute inset-0 rounded-lg overflow-hidden bg-black/0 group-hover/poster:bg-black/40 transition-colors duration-300 pointer-events-none z-20" />
  )
}

/**
 * 标题 + 年份 meta 区（两分支共用）。
 * @param titleLinksToDetail true=标题自带 <Link>（takeover：海报→播放器、标题→详情，两出口）；
 *   false=标题裸 <p>（navigate：整卡根已是 <Link>，**不可设 true，否则嵌套 <Link> 非法 + 双可点区**）。
 */
function VideoCardMeta({
  video,
  detailHref,
  titleLinksToDetail,
}: {
  video: VideoCardType
  detailHref: string
  titleLinksToDetail: boolean
}) {
  const title = (
    <p
      className="line-clamp-2 group-hover:text-[var(--accent-default)] transition-colors"
      style={{ color: 'var(--fg-default)', fontSize: '13px', fontWeight: 500, lineHeight: '1.4' }}
    >
      {video.title}
    </p>
  )

  return (
    <div className="mt-2 space-y-0.5 relative z-10">
      {titleLinksToDetail ? (
        <Link href={detailHref} aria-label={`${video.title} 详情页`} className="block">
          {title}
        </Link>
      ) : (
        title
      )}
      {video.year && (
        <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
          {video.year}
          {video.episodeCount > 1 && ` · ${video.episodeCount}集`}
        </p>
      )}
    </div>
  )
}

// ── 交互分支组件 ─────────────────────────────────────────────────────────────

/** takeover 分支：海报 Fast Takeover 直达播放器 + 标题独立链详情页（保留 player store）。 */
function VideoCardTakeover({ video, className }: { video: VideoCardType; className?: string }) {
  const enter = usePlayerStore((s) => s.enter)
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) ?? 'en'
  const detailHref = getVideoDetailHref(video)
  const watchSlug = video.slug ? `${video.slug}-${video.shortId}` : video.shortId
  const watchHref = `/${locale}/watch/${watchSlug}?ep=1`

  function handlePosterClick() {
    enter({
      shortId: video.shortId,
      slug: video.slug,
      episode: 1,
      transition: 'fast-takeover',
    })
    router.push(watchHref)
  }

  return (
    <article className={cn('group relative block', className)} data-testid="video-card" data-interaction="takeover">
      {/* 图片区 — PosterAction: 点击触发 Fast Takeover 直达播放器 */}
      {/* no overflow-hidden: StackedPosterFrame box-shadow must be visible outside its bounds */}
      {/* group/poster scopes FloatingPlayButton & overlay hover to image area only */}
      <div className="relative rounded-lg group/poster">
        <VideoCardCover video={video} />

        <button
          type="button"
          className="absolute inset-0 cursor-pointer z-20"
          aria-label={`播放《${video.title}》第 1 集`}
          onClick={handlePosterClick}
        />

        <PosterHoverDim />

        <FloatingPlayButton />

        <TagLayer {...videoCardToTagProps(video)} />
      </div>

      {/* 文字区 — MetaAction: 点击跳详情页 */}
      <VideoCardMeta video={video} detailHref={detailHref} titleLinksToDetail />
    </article>
  )
}

/** navigate 分支：整卡 <Link> 纯跳转详情页，无 player store / FloatingPlayButton（D-214-7 P2）。 */
function VideoCardNavigate({ video, className }: { video: VideoCardType; className?: string }) {
  const detailHref = getVideoDetailHref(video)

  return (
    <Link
      href={detailHref}
      className={cn('group relative block', className)}
      data-testid="video-card"
      data-interaction="navigate"
      style={{ textDecoration: 'none' }}
    >
      <div className="relative rounded-lg group/poster">
        <VideoCardCover video={video} />

        <PosterHoverDim />

        <TagLayer {...videoCardToTagProps(video)} />
      </div>

      <VideoCardMeta video={video} detailHref={detailHref} titleLinksToDetail={false} />
    </Link>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function VideoCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('block', className)} data-testid="video-card-skeleton" aria-hidden="true">
      {/* Cover — matches StackedPosterFrame 2:3 aspect-ratio + rounded-lg */}
      <Skeleton shape="rect" className="rounded-lg w-full" style={{ aspectRatio: '2/3' }} />
      <div className="mt-2 space-y-1.5">
        {/* Title — 13px line-height 1.4（CARD-SIZING-B 归一） */}
        <Skeleton shape="text" height={13} delay={300} />
        {/* Subtitle — text-xs, 2/3 width */}
        <Skeleton shape="text" height={12} className="w-2/3" delay={300} />
      </div>
    </div>
  )
}

// ── 分发器 ───────────────────────────────────────────────────────────────────

export function VideoCard({ video, interaction = 'takeover', className }: VideoCardProps) {
  return interaction === 'navigate' ? (
    <VideoCardNavigate video={video} className={className} />
  ) : (
    <VideoCardTakeover video={video} className={className} />
  )
}

VideoCard.Skeleton = VideoCardSkeleton
