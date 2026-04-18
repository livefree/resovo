/**
 * player.types.ts — 播放器与弹幕类型
 */

import type { VideoSource, Subtitle } from './video.types'

// ── 播放器状态（对应 playerStore）────────────────────────────────

export interface PlayerState {
  // 当前播放内容
  videoId: string | null
  episodeNumber: number | null
  currentSource: VideoSource | null
  availableSources: VideoSource[]

  // 播放控制（只有 VideoPlayer 组件可写）
  isPlaying: boolean
  currentTime: number        // 秒
  duration: number           // 秒
  volume: number             // 0-1
  isMuted: boolean
  speed: number              // 0.25-2，默认 1

  // 字幕（只有 ControlBar 可写）
  activeSubtitle: Subtitle | null
  availableSubtitles: Subtitle[]

  // 布局（只有 ControlBar 可写）
  theaterMode: boolean       // 桌面端专属，移动端始终 false

  // 面板开关状态（用于键盘状态机判断，ADR-011）
  speedPanelOpen: boolean
  episodeOverlayOpen: boolean

  // 弹幕
  danmakuEnabled: boolean
  danmakuOpacity: number     // 0-1
  danmakuFontSize: number    // 0-1 相对大小

  // 断点续播（ADR-012）
  resumePromptVisible: boolean   // 是否显示"继续播放"提示条
  resumeFromSeconds: number | null  // 上次进度（秒），null 表示无记录
}

// 播放器用户设置（持久化到 localStorage: resovo-player-settings）
export interface PlayerSettings {
  autoPlayNext: boolean      // 自动播放下一集，默认 true
  resumePlayback: boolean    // 断点续播，默认 true
  subtitleColor: string      // 字幕文字颜色，默认 #ffffff
  subtitleBgColor: string    // 字幕背景色，默认 #000000
  subtitleBgOpacity: number  // 字幕背景透明度 0-100，默认 75
}

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  autoPlayNext: true,
  resumePlayback: true,
  subtitleColor: '#ffffff',
  subtitleBgColor: '#000000',
  subtitleBgOpacity: 75,
}

// ── 播放速度预设 ─────────────────────────────────────────────────

export const SPEED_PRESETS = [0.5, 1.0, 1.5, 2.0] as const
export type SpeedPreset = typeof SPEED_PRESETS[number]

// 数字键 1-4 对应的倍速预设
export const SPEED_KEY_MAP: Record<string, SpeedPreset> = {
  '1': 0.5,
  '2': 1.0,
  '3': 1.5,
  '4': 2.0,
}

// 快进/后退步进（秒）
export const SEEK_STEP_SECONDS = 5

// 断点续播触发阈值（秒）
export const RESUME_THRESHOLD_SECONDS = 30

// 断点续播记录精度（秒）
export const RESUME_PRECISION_SECONDS = 5

// ── 弹幕 ─────────────────────────────────────────────────────────

export type DanmakuType = 'scroll' | 'top' | 'bottom'

export interface Danmaku {
  id: string
  videoId: string
  userId: string
  episodeNumber: number | null
  timeSeconds: number        // 出现时间点
  content: string
  color: string              // 十六进制，如 #ffffff
  type: DanmakuType
  createdAt: string
}

export interface SendDanmakuInput {
  episode?: number
  timeSeconds: number
  content: string
  color?: string             // 默认 #ffffff
  type?: DanmakuType         // 默认 scroll
}

// ── 评论 ─────────────────────────────────────────────────────────

export interface Comment {
  id: string
  videoId: string
  userId: string
  user: {
    id: string
    username: string
    avatarUrl: string | null
  }
  episodeNumber: number | null
  content: string
  likeCount: number
  parentId: string | null    // 回复时有值
  createdAt: string
}

export interface CreateCommentInput {
  content: string
  episode?: number
  parentId?: string          // 回复时传入
}

export interface CommentListParams {
  episode?: number
  sort?: 'hot' | 'latest'
  page?: number
  limit?: number
}
