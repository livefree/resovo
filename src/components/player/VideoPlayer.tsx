/**
 * VideoPlayer.tsx — @livefree/yt-player 封装
 * CHG-20: 替换 video.js，使用项目自有播放器组件
 * 必须通过 dynamic import + ssr: false 使用，不可 SSR
 */

'use client'

import { YTPlayer } from '@livefree/yt-player'
import '@livefree/yt-player/dist/index.css'

export interface VideoPlayerProps {
  /** HLS .m3u8 或 MP4 直链 */
  src: string
  /** 视频标题（显示在控制栏顶部） */
  title?: string
  /** 剧集列表（存在时启用选集面板） */
  episodes?: Array<{ title?: string }>
  /** 当前集数（0-based） */
  activeEpisodeIndex?: number
  /** 用户在播放器内选集时回调（0-based index） */
  onEpisodeChange?: (index: number) => void
  /** 断点续播起始时间（秒） */
  startTime?: number
  /** 播放进度更新（秒, 总时长秒），约 250ms 一次 */
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onEnded?: () => void
  /** 存在时显示"下一集"按钮 */
  onNext?: () => void
  /** 剧场模式切换回调 */
  onTheaterChange?: (isTheater: boolean) => void
  className?: string
}

export function VideoPlayer({
  src,
  title,
  episodes,
  activeEpisodeIndex = 0,
  onEpisodeChange,
  startTime,
  onTimeUpdate,
  onEnded,
  onNext,
  onTheaterChange,
  className,
}: VideoPlayerProps) {
  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%' }}
      data-testid="video-player"
    >
      <YTPlayer
        src={src}
        title={title}
        episodes={episodes}
        activeEpisodeIndex={activeEpisodeIndex}
        onEpisodeChange={onEpisodeChange}
        startTime={startTime}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onNext={onNext}
        onTheaterChange={onTheaterChange}
      />
    </div>
  )
}
