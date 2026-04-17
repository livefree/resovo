/**
 * playerStore.ts — 播放器全局状态
 * CHG-20: 简化状态，移除 video.js 面板状态（YTPlayer 内部管理）
 * ADR-012: 断点续播双轨存储
 */

import { create } from 'zustand'

export type PlayerMode = 'default' | 'theater'

interface PlayerState {
  // ── 视频信息 ───────────────────────────────────────────────────
  shortId: string | null
  currentEpisode: number

  // ── 播放状态（用于弹幕时间轴同步、观看历史上报） ──────────────
  isPlaying: boolean
  currentTime: number     // 秒
  duration: number        // 秒

  // ── 布局模式（YTPlayer onTheaterChange 回调驱动） ─────────────
  mode: PlayerMode

  // ── Actions ────────────────────────────────────────────────────
  initPlayer: (shortId: string, episode: number) => void
  setEpisode: (episode: number) => void
  setPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setMode: (mode: PlayerMode) => void
  toggleMode: () => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  shortId: null,
  currentEpisode: 1,

  isPlaying: false,
  currentTime: 0,
  duration: 0,

  mode: 'default',

  initPlayer: (shortId, episode) =>
    set({
      shortId,
      currentEpisode: episode,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }),

  setEpisode: (episode) => set({ currentEpisode: episode, currentTime: 0 }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setMode: (mode) => set({ mode }),
  toggleMode: () =>
    set((s) => ({ mode: s.mode === 'default' ? 'theater' : 'default' })),
}))
