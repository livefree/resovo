'use client'

import { VideoPlayer } from './VideoPlayer'

export interface PlayerPreviewProps {
  src: string
  title?: string
  className?: string
}

export function PlayerPreview({ src, title, className }: PlayerPreviewProps) {
  return (
    <div
      className={className}
      style={{ width: '100%', aspectRatio: '16/9', background: '#000' }}
    >
      <VideoPlayer src={src} title={title} />
    </div>
  )
}
