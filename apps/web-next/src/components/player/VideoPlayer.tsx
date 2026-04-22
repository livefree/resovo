'use client'

import dynamic from 'next/dynamic'
import type { PlayerProps } from '@resovo/player-core'

const Player = dynamic(
  () => import('@resovo/player-core').then((m) => ({ default: m.Player })),
  { ssr: false }
)

export interface VideoPlayerProps extends PlayerProps {
  className?: string
}

export function VideoPlayer({ className, ...props }: VideoPlayerProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%' }} data-testid="video-player">
      <Player {...props} />
    </div>
  )
}
