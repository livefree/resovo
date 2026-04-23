'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { VideoType } from '@resovo/types'

/**
 * ChipType — 视频类型徽章（HANDOFF-07）
 *
 * 设计契约：
 *   - 消费 tokens：`--tag-chip-{type}-{bg,fg}`（11 种 VideoType 映射）
 *   - 无硬编码颜色，所有色值走 CSS 变量（Light/Dark 自动切换）
 *   - 色盲可辨：色 + 文字双重区分（不仅靠色）
 *   - i18n label 走 `videoType.{type}` namespace
 *
 * 11 种 VideoType 全覆盖：
 *   movie / series / anime / variety / documentary / short / sports / music / news / kids / other
 *
 * 参考设计稿：docs/handoff_20260422/designs/home-b-2.html:732-742
 */

const VALID_TYPES = new Set<VideoType>([
  'movie',
  'series',
  'anime',
  'variety',
  'documentary',
  'short',
  'sports',
  'music',
  'news',
  'kids',
  'other',
])

export interface ChipTypeProps {
  readonly type: VideoType
  readonly size?: 'sm' | 'md'
  readonly className?: string
  readonly 'data-testid'?: string
}

export function ChipType({ type, size = 'sm', className, 'data-testid': testId }: ChipTypeProps) {
  const t = useTranslations('videoType')
  // 未知 type 降级到 'other'（前向兼容：新增 VideoType 且 tokens 未及时跟进时不崩）
  const safeType: VideoType = VALID_TYPES.has(type) ? type : 'other'

  const sizeClass =
    size === 'md'
      ? 'text-[12px] px-2.5 py-0.5'
      : 'text-[11px] px-2 py-[2px]'

  return (
    <span
      data-chip-type={safeType}
      data-testid={testId ?? `chip-type-${safeType}`}
      className={cn(
        'inline-flex items-center gap-1 font-semibold leading-[1.4] rounded-md whitespace-nowrap',
        sizeClass,
        className,
      )}
      style={{
        background: `var(--tag-chip-${safeType}-bg)`,
        color: `var(--tag-chip-${safeType}-fg)`,
      }}
    >
      {t(safeType)}
    </span>
  )
}
