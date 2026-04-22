import { cn } from '@/lib/utils'
import type { FallbackCoverProps, FallbackVariant, MediaAspect } from './types'
import type { VideoType } from '@resovo/types'

// ── 常量映射 ──────────────────────────────────────────────────────

const ASPECT_MAP: Record<MediaAspect, string> = {
  '2:3':  '2 / 3',
  '16:9': '16 / 9',
  '1:1':  '1 / 1',
  '5:6':  '5 / 6',
  '21:9': '21 / 9',
}

const VARIANT_ASPECT: Record<FallbackVariant, string> = {
  poster:  '2 / 3',
  still:   '16 / 9',
  avatar:  '1 / 1',
  generic: '2 / 3',
}

const ARIA_LABELS: Record<FallbackVariant, string> = {
  poster:  'Poster image unavailable',
  still:   'Image unavailable',
  avatar:  'Avatar image unavailable',
  generic: 'Image unavailable',
}

const TYPE_LABELS: Partial<Record<VideoType, string>> = {
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
}

// ── 工具函数 ──────────────────────────────────────────────────────

function hashSeed(seed: string): number {
  let h = 5381
  for (let i = 0; i < seed.length; i++) {
    h = (((h << 5) + h) ^ seed.charCodeAt(i)) >>> 0
  }
  return h
}

function gradientVar(seed?: string): string {
  if (!seed) return 'var(--fallback-gradient-0, var(--bg-surface-raised))'
  const idx = hashSeed(seed) % 6
  return `var(--fallback-gradient-${idx}, var(--bg-surface-raised))`
}

// ── 类型专属图标 ──────────────────────────────────────────────────

interface IconProps { scale: number }

const SVG_BASE = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.5',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
}

function FilmIcon({ scale }: IconProps) {
  return (
    <svg {...SVG_BASE} style={{ width: `${scale * 100}%`, height: 'auto' }}>
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="17" y1="7" x2="22" y2="7" />
      <line x1="17" y1="17" x2="22" y2="17" />
      <line x1="2" y1="17" x2="7" y2="17" />
    </svg>
  )
}

/** 剧集：电视机 + 天线 */
function TVIcon({ scale }: IconProps) {
  return (
    <svg {...SVG_BASE} style={{ width: `${scale * 100}%`, height: 'auto' }}>
      <rect x="2" y="7" width="20" height="13" rx="2" />
      <line x1="8" y1="20" x2="16" y2="20" />
      <line x1="12" y1="20" x2="12" y2="23" />
      <line x1="8" y1="4" x2="12" y2="7" />
      <line x1="16" y1="4" x2="12" y2="7" />
    </svg>
  )
}

/** 动漫：星形爆裂 */
function AnimeIcon({ scale }: IconProps) {
  return (
    <svg {...SVG_BASE} style={{ width: `${scale * 100}%`, height: 'auto' }}>
      <polygon points="12,2 14.5,9 22,9 16,13.5 18.5,21 12,16.5 5.5,21 8,13.5 2,9 9.5,9" />
    </svg>
  )
}

/** 综艺：均衡器音波竖条 */
function VarietyIcon({ scale }: IconProps) {
  return (
    <svg {...SVG_BASE} style={{ width: `${scale * 100}%`, height: 'auto' }}>
      <rect x="3"  y="12" width="3" height="9"  rx="1" />
      <rect x="8"  y="7"  width="3" height="14" rx="1" />
      <rect x="13" y="9"  width="3" height="12" rx="1" />
      <rect x="18" y="4"  width="3" height="17" rx="1" />
    </svg>
  )
}

/** 纪录片：山峦等高线 */
function DocumentaryIcon({ scale }: IconProps) {
  return (
    <svg {...SVG_BASE} style={{ width: `${scale * 100}%`, height: 'auto' }}>
      <polyline points="2,20 7,11 12,16 16,8 22,20" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  )
}

/** 头像通用 */
function AvatarIcon({ scale }: IconProps) {
  return (
    <svg {...SVG_BASE} style={{ width: `${scale * 100}%`, height: 'auto' }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function getTypeIcon(type: VideoType | undefined, scale: number) {
  switch (type) {
    case 'movie':       return <FilmIcon scale={scale} />
    case 'series':      return <TVIcon scale={scale} />
    case 'anime':       return <AnimeIcon scale={scale} />
    case 'variety':     return <VarietyIcon scale={scale} />
    case 'documentary': return <DocumentaryIcon scale={scale} />
    default:            return <FilmIcon scale={scale} />
  }
}

// ── 主组件 ────────────────────────────────────────────────────────

export function FallbackCover({
  aspect,
  aspectRatio,
  width,
  height,
  className,
  ariaLabel,
  iconScale = 0.32,
  variant = 'generic',
  title,
  originalTitle,
  type,
  seed,
  brandLogoUrl,
  'data-testid': testId,
}: FallbackCoverProps) {
  const displayTitle = title || originalTitle
  const resolvedAspectRatio = aspect
    ? ASPECT_MAP[aspect]
    : (aspectRatio ?? VARIANT_ASPECT[variant])
  const label = ariaLabel ?? ARIA_LABELS[variant]
  const typeLabel = type ? TYPE_LABELS[type] : undefined

  return (
    <div
      role="img"
      aria-label={label}
      data-testid={testId}
      className={cn('relative grid place-items-center overflow-hidden', className)}
      style={{
        aspectRatio: resolvedAspectRatio,
        width,
        height,
        background: gradientVar(seed),
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--fg-muted)',
      }}
    >
      {/* 品牌角标：有 brandLogoUrl 时显示图片，否则 CSS --brand-initial 文字回落 */}
      {brandLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brandLogoUrl}
          alt=""
          aria-hidden
          className="absolute bottom-2 right-2 h-4 w-auto opacity-40 object-contain"
        />
      ) : (
        <span
          className="fallback-cover__brand absolute right-2 top-2 text-xs font-semibold opacity-40"
          aria-hidden
        />
      )}

      {/* 居中图标（无标题时） */}
      {!displayTitle && (
        variant === 'avatar'
          ? <AvatarIcon scale={iconScale} />
          : getTypeIcon(type, iconScale)
      )}

      {/* 底部标题遮罩 */}
      {displayTitle && (
        <div
          className="absolute inset-x-0 bottom-0 px-2 pb-2 pt-6"
          style={{ background: 'var(--surface-scrim)' }}
        >
          <p
            className="truncate text-xs font-medium leading-tight"
            style={{ color: 'var(--fg-on-accent)' }}
          >
            {displayTitle}
          </p>
          {typeLabel && (
            <span
              className="mt-0.5 inline-block text-[10px] leading-none opacity-80"
              style={{ color: 'var(--fg-on-accent)' }}
            >
              {typeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
