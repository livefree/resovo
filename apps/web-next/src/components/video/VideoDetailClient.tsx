'use client'

/**
 * VideoDetailClient — HANDOFF-17/24/27 对齐 docs/frontend_design_spec_20260423.md §14
 *
 * 布局：
 *   Hero（max-w-feature，双栏 280px+1fr）
 *   EpisodePicker（max-w-feature，repeat(10,1fr)，选集范围切换）→ 点击直接跳 /watch
 *   下方双栏（1fr + --detail-sidebar-w 320px，gap --detail-sidebar-gap 40px）
 *     主列：剧情简介（折叠）+ 演职员列表
 *     侧栏：RelatedVideos（竖向列表）
 *
 * section 间距：var(--detail-section-gap) 48px
 * 简介↔主创间距：var(--detail-desc-cast-gap) 28px
 */

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { extractShortId } from '@/lib/video-detail'
import { DetailHero } from '@/components/detail/DetailHero'
import { EpisodePicker } from '@/components/detail/EpisodePicker'
import { RelatedVideos } from '@/components/detail/RelatedVideos'
import { SafeImage } from '@/components/media'
import type { Video, ApiResponse } from '@resovo/types'

// ── DescriptionBlock ─────────────────────────────────────────────────────────

function DescriptionBlock({ description }: { description: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const [showToggle, setShowToggle] = useState(false)
  const clampRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = clampRef.current
    if (!el) return
    setShowToggle(el.scrollHeight > el.clientHeight)
  }, [description])

  if (!description) return null

  return (
    <section style={{ marginBottom: 'var(--detail-desc-cast-gap)' }}>
      <h3
        style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--fg-default)',
          marginBottom: '10px',
        }}
      >
        剧情简介
      </h3>
      <p
        ref={clampRef}
        style={{
          fontSize: '14px',
          lineHeight: '1.7',
          color: 'var(--fg-muted)',
          margin: 0,
          ...(expanded
            ? {}
            : {
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }),
        }}
      >
        {description}
      </p>
      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: '8px',
            fontSize: '13px',
            color: 'var(--accent-default)',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          {expanded ? '收起' : '展开'}
        </button>
      )}
    </section>
  )
}

// ── CastBlock ─────────────────────────────────────────────────────────────────

interface CastBlockProps {
  director: string[]
  cast: string[]
}

function CastBlock({ director, cast }: CastBlockProps) {
  // TODO: 当前 /videos/:slug 的 cast/director 字段仅含名字字符串，无头像 URL。
  // 待后端提供 /media-catalog/:catalogId/credits 端点后，替换为真实头像图片。
  if (director.length === 0 && cast.length === 0) return null

  return (
    <section style={{ marginBottom: 'var(--detail-section-gap)' }}>
      <h3
        style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--fg-default)',
          marginBottom: '12px',
        }}
      >
        演职人员
      </h3>

      {director.length > 0 && (
        <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--fg-muted)' }}>
          <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>导演：</span>
          {director.join('、')}
        </div>
      )}

      {cast.length > 0 && (
        <div
          data-testid="cast-list"
          style={{
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
          }}
        >
          {cast.map((name) => (
            <div
              key={name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0,
                width: '56px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <SafeImage
                  src={undefined}
                  aspect="1:1"
                  width={40}
                  height={40}
                  alt={name}
                  fallback={{ variant: 'avatar', ariaLabel: name }}
                />
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--fg-muted)',
                  textAlign: 'center',
                  lineHeight: 1.3,
                  wordBreak: 'break-all',
                }}
              >
                {name}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Props & Skeleton ──────────────────────────────────────────────────────────

interface Props {
  slug: string
  showEpisodes?: boolean
}

export function VideoDetailClientSkeleton() {
  return (
    <div>
      <div className="detail-cascade-1">
        <DetailHero.Skeleton />
      </div>
    </div>
  )
}

export function VideoDetailClient({ slug, showEpisodes }: Props) {
  const searchParams = useSearchParams()
  const [video, setVideo] = useState<Video | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [activeEpisode, setActiveEpisode] = useState(() => {
    const ep = Number(searchParams.get('ep'))
    return ep >= 1 ? ep : 1
  })

  useEffect(() => {
    const shortId = extractShortId(slug)
    apiClient
      .get<ApiResponse<Video>>(`/videos/${shortId}`)
      .then((res) => setVideo(res.data))
      .catch(() => setNotFound(true))
  }, [slug])

  if (notFound) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'var(--fg-muted)' }}>视频不存在或已下线</p>
      </div>
    )
  }

  if (!video) return <VideoDetailClientSkeleton />

  const watchSlug = video.slug ? `${video.slug}-${video.shortId}` : video.shortId

  return (
    <>
      {/* Hero 区 */}
      <div className="detail-cascade-1">
        <DetailHero video={video} episode={activeEpisode} />
      </div>

      {/* 选集区 */}
      {showEpisodes && video.episodeCount > 1 && (
        <div className="detail-cascade-2" style={{ marginTop: 0 }}>
          <EpisodePicker
            video={video}
            watchBase={`/watch/${watchSlug}`}
            onEpisodeChange={setActiveEpisode}
          />
        </div>
      )}

      {/* 下方区：主内容 + 侧栏 */}
      <div
        className="max-w-feature mx-auto px-6"
        style={{ paddingTop: 'var(--detail-section-gap)', paddingBottom: 'var(--detail-section-gap)' }}
      >
        {/* mobile=单列，≥1024=1fr + 侧栏 */}
        <div className="detail-lower-grid items-start">
          {/* 主列 */}
          <div className="min-w-0">
            <DescriptionBlock description={video.description} />
            <CastBlock director={video.director} cast={video.cast} />
          </div>

          {/* 侧栏：相关推荐 */}
          <aside className="detail-cascade-3">
            <RelatedVideos video={video} variant="sidebar" />
          </aside>
        </div>
      </div>
    </>
  )
}

VideoDetailClient.Skeleton = VideoDetailClientSkeleton
