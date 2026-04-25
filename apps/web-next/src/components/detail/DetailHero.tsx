'use client'

import { useRouter } from 'next/navigation'
import { MetaChip } from '@/components/search/MetaChip'
import { SafeImage } from '@/components/media'
import { SharedElement as SharedElementBase } from '@/components/primitives/shared-element/SharedElement'
import type { SharedElementComponent } from '@/components/primitives/shared-element/types'
import { reportBrokenImage } from '@/lib/report-broken-image'
import { usePlayerStore } from '@/stores/playerStore'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import { Breadcrumb } from '@/components/primitives/breadcrumb/Breadcrumb'
import { ALL_CATEGORIES } from '@/lib/categories'
import type { Video, VideoSource } from '@resovo/types'

const SharedElement = SharedElementBase as SharedElementComponent

const TYPE_LABELS: Record<string, string> = {
  movie:       '电影',
  series:      '剧集',
  anime:       '动漫',
  variety:     '综艺',
  documentary: '纪录片',
  short:       '短剧',
  sports:      '体育',
  music:       '音乐',
  news:        '新闻',
  kids:        '少儿',
  other:       '其他',
}

const STATUS_LABELS: Record<string, string> = {
  ongoing:   '连载中',
  completed: '已完结',
}

const GENRE_LABELS: Record<string, string> = {
  action:       '动作',
  comedy:       '喜剧',
  romance:      '爱情',
  thriller:     '惊悚',
  horror:       '恐怖',
  sci_fi:       '科幻',
  fantasy:      '奇幻',
  history:      '历史',
  crime:        '犯罪',
  mystery:      '悬疑',
  war:          '战争',
  family:       '家庭',
  biography:    '传记',
  martial_arts: '武侠',
  other:        '其他',
}

const LANG_LABELS: Record<string, string> = {
  'zh-CN': '中文',
  'zh-TW': '繁体',
  en:      '英文',
  ja:      '日文',
  ko:      '韩文',
  fr:      '法文',
  de:      '德文',
  es:      '西语',
  ru:      '俄文',
  pt:      '葡语',
  ar:      '阿拉伯语',
  th:      '泰文',
  vi:      '越南语',
}

interface MetaRowProps {
  label: string
  names: string[]
  type: 'director' | 'actor' | 'writer'
}

function MetaRow({ label, names, type }: MetaRowProps) {
  if (names.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      <span
        className="text-xs shrink-0 pt-0.5"
        style={{ color: 'var(--fg-muted)', minWidth: '80px' }}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {names.map((name) => (
          <MetaChip key={name} label={name} type={type} />
        ))}
      </div>
    </div>
  )
}

// ── DetailHero ────────────────────────────────────────────────────────────────

interface DetailHeroProps {
  video: Video
  /** 当前选中集，用于 standard-takeover 播放 */
  episode?: number
  sources?: VideoSource[]
  activeSourceId?: string | null
  onSourceChange?: (id: string) => void
}

export function DetailHero({ video, episode = 1, sources = [], activeSourceId, onSourceChange }: DetailHeroProps) {
  const enter = usePlayerStore((s) => s.enter)
  const router = useRouter()

  function handlePlay() {
    const watchHref = video.slug
      ? `/watch/${video.slug}-${video.shortId}?ep=${episode}`
      : `/watch/${video.shortId}?ep=${episode}`
    enter({ shortId: video.shortId, slug: video.slug, episode, transition: 'standard-takeover' })
    router.push(watchHref)
  }

  const hasPersonnel =
    video.director.length > 0 || video.cast.length > 0 || video.writers.length > 0

  const subtitleDisplay = video.subtitleLangs
    .map((lang) => LANG_LABELS[lang] ?? lang)
    .slice(0, 4)
    .join(' / ')

  const typeEntry = ALL_CATEGORIES.find((c) => c.videoType === video.type)
  const typeParam = typeEntry?.typeParam ?? 'others'
  const breadcrumbItems = [
    { label: '首页', href: '/' },
    { label: TYPE_LABELS[video.type] ?? video.type, href: `/${typeParam}` },
    { label: video.title },
  ]

  return (
    <section
      className="relative"
      style={{ background: 'var(--bg-canvas)' }}
      data-testid="detail-hero"
    >
      {/* 装饰性模糊背景 */}
      {video.coverUrl && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <SafeImage
            src={video.coverUrl}
            alt=""
            width={1920}
            height={1080}
            priority
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', aspectRatio: 'unset' }}
            imgClassName="object-cover opacity-10 blur-xl scale-110"
            fallback={{ seed: video.id }}
          />
        </div>
      )}

      <div
        className="relative z-10 max-w-feature mx-auto px-6"
        style={{ paddingTop: 'var(--detail-hero-padding-y)', paddingBottom: 'var(--detail-hero-padding-y)' }}
      >
        <Breadcrumb items={breadcrumbItems} />

        {/* 双栏网格：mobile=单列，≥768=280px 1fr */}
        <div className="detail-hero-grid items-start">

        {/* 封面列 */}
        <div
          className="mx-auto md:mx-0"
          style={{ width: '100%', maxWidth: 'var(--detail-cover-w)' }}
        >
          <SharedElement.Target
            id={`video-card-${video.id}`}
            as="div"
            className="relative w-full rounded-2xl overflow-hidden shadow-2xl border"
            style={{ borderColor: 'color-mix(in srgb, var(--fg-default) 10%, transparent)' }}
          >
            <SafeImage
              src={video.coverUrl}
              alt={video.title}
              width={240}
              height={360}
              aspect="2:3"
              blurHash={video.posterBlurhash ?? undefined}
              data-testid="detail-cover"
              imgClassName="object-cover"
              fallback={{ title: video.title, type: video.type, seed: video.id }}
              onLoadFail={({ src }) =>
                reportBrokenImage({ videoId: video.id, imageKind: 'poster', url: src })
              }
            />
          </SharedElement.Target>
        </div>

        {/* 右侧元信息 */}
        <div className="flex flex-col min-w-0" style={{ gap: 'var(--detail-meta-gap)' }}>

          <div className="space-y-1">
            <h1
              className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight"
              style={{ color: 'var(--fg-default)' }}
              data-testid="detail-title"
            >
              {video.title}
            </h1>
            {video.titleEn && (
              <p className="text-base font-medium tracking-wide" style={{ color: 'var(--fg-muted)' }}>
                {video.titleEn}
              </p>
            )}
            {video.titleOriginal && video.titleOriginal !== video.titleEn && (
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                {video.titleOriginal}
              </p>
            )}
          </div>

          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
            style={{ color: 'var(--fg-muted)' }}
          >
            {video.year && <span>{video.year}</span>}
            {video.country && (
              <>
                <span className="opacity-30">·</span>
                <span>{video.country}</span>
              </>
            )}
            <span className="opacity-30">·</span>
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ background: 'var(--accent-default)', color: 'var(--accent-fg)' }}
            >
              {TYPE_LABELS[video.type] ?? video.type}
            </span>
            <span className="opacity-30">·</span>
            <span>{STATUS_LABELS[video.status] ?? video.status}</span>
            {video.episodeCount > 1 && (
              <>
                <span className="opacity-30">·</span>
                <span>全 {video.episodeCount} 集</span>
              </>
            )}
            {video.runtimeMinutes !== null && video.runtimeMinutes > 0 && (
              <>
                <span className="opacity-30">·</span>
                <span>{video.runtimeMinutes} 分钟</span>
              </>
            )}
          </div>

          {video.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {video.genres.map((genre) => (
                <MetaChip key={genre} label={GENRE_LABELS[genre] ?? genre} type="genre" />
              ))}
            </div>
          )}

          <div
            className="flex flex-wrap items-center gap-y-2 text-sm"
            style={{ gap: 'var(--detail-rating-btn-gap)' }}
          >
            {video.rating !== null && (
              <div className="flex items-center gap-1.5">
                <span style={{ color: 'var(--accent-default)' }}>★</span>
                <span className="text-lg font-extrabold" style={{ color: 'var(--fg-default)' }}>
                  {video.rating.toFixed(1)}
                </span>
                {video.ratingVotes !== null && video.ratingVotes > 0 && (
                  <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                    ({video.ratingVotes.toLocaleString()} 人评)
                  </span>
                )}
              </div>
            )}

            {video.subtitleLangs.length > 0 && (
              <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                字幕：{subtitleDisplay}
              </div>
            )}
          </div>

          {/* CTA 播放按钮（右栏） */}
          <button
            type="button"
            onClick={handlePlay}
            className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
            style={{
              alignSelf: 'flex-start',
              background: 'var(--accent-default)',
              color: 'var(--accent-fg)',
              boxShadow: 'var(--detail-play-glow)',
              minWidth: '140px',
            }}
            data-testid="detail-play-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            立即播放
          </button>

          {/* 播放源选择器 */}
          {sources.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--fg-muted)',
                  flexShrink: 0,
                  paddingTop: '5px',
                }}
              >
                播放源
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {sources.map((source) => {
                  const isActive = source.id === activeSourceId
                  const label = source.siteDisplayName ?? source.sourceName
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => onSourceChange?.(source.id)}
                      data-testid={`source-btn-${source.id}`}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        border: '1px solid',
                        cursor: 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                        ...(isActive
                          ? {
                              background: 'var(--accent-muted)',
                              color: 'var(--accent-default)',
                              borderColor: 'var(--accent-default)',
                              fontWeight: 600,
                            }
                          : {
                              background: 'var(--bg-surface-sunken)',
                              color: 'var(--fg-muted)',
                              borderColor: 'var(--border-default)',
                            }),
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {(hasPersonnel || video.aliases.length > 0 || video.languages.length > 0 || video.tags.length > 0) && (
            <div
              className="flex flex-col pt-3 border-t"
              style={{ borderColor: 'var(--border-default)', gap: 'var(--detail-meta-row-gap)' }}
              data-testid="detail-hero-meta"
            >
              <MetaRow label="导演" names={video.director} type="director" />
              <MetaRow label="编剧" names={video.writers} type="writer" />
              <MetaRow label="演员" names={video.cast} type="actor" />
              {video.aliases.length > 0 && (
                <div className="flex gap-2 items-start">
                  <span className="text-xs shrink-0 pt-0.5 w-12" style={{ color: 'var(--fg-muted)' }}>别名</span>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                    {video.aliases.join(' / ')}
                  </p>
                </div>
              )}
              {video.languages.length > 0 && (
                <div className="flex gap-2 items-start">
                  <span className="text-xs shrink-0 pt-0.5 w-12" style={{ color: 'var(--fg-muted)' }}>语言</span>
                  <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>{video.languages.join(' / ')}</p>
                </div>
              )}
              {video.tags.length > 0 && (
                <div className="flex gap-2 items-start">
                  <span className="text-xs shrink-0 pt-0.5 w-12" style={{ color: 'var(--fg-muted)' }}>标签</span>
                  <div className="flex flex-wrap gap-1">
                    {video.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded text-xs border"
                        style={{ color: 'var(--fg-muted)', borderColor: 'var(--border-default)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
        </div>{/* /grid */}
      </div>
    </section>
  )
}

function DetailHeroSkeleton() {
  return (
    <div
      className="relative z-10 max-w-feature mx-auto px-6"
      style={{ paddingTop: 'var(--detail-hero-padding-y)', paddingBottom: 'var(--detail-hero-padding-y)' }}
    >
      <Skeleton shape="text" width={200} height={12} style={{ marginBottom: '20px' }} />
      <div className="detail-hero-grid items-start">
        <div style={{ width: '100%', maxWidth: 'var(--detail-cover-w)' }}>
          <Skeleton shape="rect" className="w-full rounded-2xl" style={{ aspectRatio: '2/3' }} />
        </div>
        <div className="flex flex-col" style={{ gap: 'var(--detail-meta-gap)' }}>
          <Skeleton shape="text" height={40} className="w-3/4" />
          <Skeleton shape="text" height={20} className="w-1/2" delay={300} />
          <Skeleton shape="text" height={16} delay={300} />
          <Skeleton shape="rect" height={48} className="rounded-xl w-40" delay={300} />
          <Skeleton shape="text" height={16} className="w-5/6" delay={300} />
        </div>
      </div>
    </div>
  )
}

DetailHero.Skeleton = DetailHeroSkeleton
