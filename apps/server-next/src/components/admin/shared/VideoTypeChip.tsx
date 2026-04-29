import type { CSSProperties } from 'react'
import type { VideoType } from '@resovo/types'

export interface VideoTypeChipProps {
  readonly type: VideoType
}

const TYPE_LABELS: Record<VideoType, string> = {
  movie:       '电影',
  series:      '剧集',
  anime:       '动漫',
  variety:     '综艺',
  documentary: '纪录片',
  short:       '短片',
  sports:      '体育',
  music:       '音乐',
  news:        '新闻',
  kids:        '少儿',
  other:       '其他',
}

const CHIP_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px var(--space-2)',
  borderRadius: 'var(--radius-full)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 500,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
  background: 'var(--state-info-bg)',
  color: 'var(--state-info-fg)',
}

export function VideoTypeChip({ type }: VideoTypeChipProps) {
  return (
    <span data-testid="video-type-chip" data-type={type} style={CHIP_STYLE}>
      {TYPE_LABELS[type] ?? type}
    </span>
  )
}
