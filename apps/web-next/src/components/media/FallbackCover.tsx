import { cn } from '@/lib/utils'
import type { FallbackCoverProps, FallbackVariant, MediaAspect } from './types'

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

const TYPE_LABELS: Partial<Record<import('@resovo/types').VideoType, string>> = {
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

// ── 图标 ──────────────────────────────────────────────────────────

function FilmIcon({ scale }: { scale: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: `${scale * 100}%`, height: 'auto' }}
      aria-hidden
    >
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

function AvatarIcon({ scale }: { scale: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: `${scale * 100}%`, height: 'auto' }}
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

// ── 组件 ──────────────────────────────────────────────────────────

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
        borderRadius: 'var(--radius-md, 8px)',
        color: 'var(--fg-muted)',
      }}
    >
      {/* 品牌角标（右上）— 通过 CSS var(--brand-initial) 注入文字 */}
      <span
        className="fallback-cover__brand absolute right-2 top-2 text-xs font-semibold opacity-40"
        aria-hidden
      />

      {/* 居中图标（无标题时） */}
      {!displayTitle && (
        variant === 'avatar'
          ? <AvatarIcon scale={iconScale} />
          : <FilmIcon scale={iconScale} />
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
