/**
 * ModerationPlayer.tsx — 审核台内嵌播放器（CHG-223）
 * 复用 Player 核心组件，渲染 HLS 流预览
 */

'use client'

import dynamic from 'next/dynamic'

const YTPlayer = dynamic(
  () => import('@/components/player/core/Player').then((m) => m.YTPlayer),
  { ssr: false }
)

interface ModerationPlayerProps {
  sourceUrl: string | null
  title?: string
  coverUrl?: string | null
}

export function ModerationPlayer({ sourceUrl, title, coverUrl }: ModerationPlayerProps) {
  if (!sourceUrl) {
    return (
      <div
        className="flex h-full min-h-[200px] items-center justify-center rounded-md bg-[var(--bg3)]"
        data-testid="moderation-player-no-source"
      >
        <p className="text-sm text-[var(--muted)]">暂无可用播放源</p>
      </div>
    )
  }

  return (
    <div
      className="aspect-video w-full overflow-hidden rounded-md bg-black"
      data-testid="moderation-player"
    >
      <YTPlayer
        src={sourceUrl}
        title={title}
        poster={coverUrl ?? undefined}
      />
    </div>
  )
}
