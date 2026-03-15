/**
 * playerStore.ts — 播放器全局状态
 * ADR-011: 键盘状态机面板焦点模式
 * ADR-012: 断点续播双轨存储
 */

import { create } from 'zustand'

// ── 类型 ──────────────────────────────────────────────────────────

export type PlayerMode = 'default' | 'theater'

interface PlayerState {
  // ── 视频信息 ───────────────────────────────────────────────────
  shortId: string | null
  currentEpisode: number

  // ── 播放状态 ───────────────────────────────────────────────────
  isPlaying: boolean
  volume: number          // 0-1
  isMuted: boolean
  playbackSpeed: number   // 0.5 | 1.0 | 1.5 | 2.0
  currentTime: number     // 秒
  duration: number        // 秒

  // ── 布局模式 ───────────────────────────────────────────────────
  mode: PlayerMode

  // ── 面板开关（ADR-011 键盘状态机） ────────────────────────────
  isEpisodePanelOpen: boolean
  isSpeedPanelOpen: boolean
  isCCPanelOpen: boolean
  isSettingsPanelOpen: boolean

  // ── Actions ────────────────────────────────────────────────────
  initPlayer: (shortId: string, episode: number) => void
  setEpisode: (episode: number) => void
  setPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setPlaybackSpeed: (speed: number) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setMode: (mode: PlayerMode) => void
  toggleMode: () => void
  openPanel: (panel: 'episode' | 'speed' | 'cc' | 'settings') => void
  closePanel: (panel: 'episode' | 'speed' | 'cc' | 'settings') => void
  closeAllPanels: () => void
}

// ── Store ─────────────────────────────────────────────────────────

export const usePlayerStore = create<PlayerState>((set, get) => ({
  shortId: null,
  currentEpisode: 1,

  isPlaying: false,
  volume: 1,
  isMuted: false,
  playbackSpeed: 1.0,
  currentTime: 0,
  duration: 0,

  mode: 'default',

  isEpisodePanelOpen: false,
  isSpeedPanelOpen: false,
  isCCPanelOpen: false,
  isSettingsPanelOpen: false,

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
  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
  setMuted: (muted) => set({ isMuted: muted }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setMode: (mode) => set({ mode }),
  toggleMode: () =>
    set((s) => ({ mode: s.mode === 'default' ? 'theater' : 'default' })),

  openPanel: (panel) => {
    const panelKey = {
      episode: 'isEpisodePanelOpen',
      speed: 'isSpeedPanelOpen',
      cc: 'isCCPanelOpen',
      settings: 'isSettingsPanelOpen',
    }[panel] as keyof PlayerState
    // 打开一个面板时关闭其他面板
    get().closeAllPanels()
    set({ [panelKey]: true } as Partial<PlayerState>)
  },

  closePanel: (panel) => {
    const panelKey = {
      episode: 'isEpisodePanelOpen',
      speed: 'isSpeedPanelOpen',
      cc: 'isCCPanelOpen',
      settings: 'isSettingsPanelOpen',
    }[panel] as keyof PlayerState
    set({ [panelKey]: false } as Partial<PlayerState>)
  },

  closeAllPanels: () =>
    set({
      isEpisodePanelOpen: false,
      isSpeedPanelOpen: false,
      isCCPanelOpen: false,
      isSettingsPanelOpen: false,
    }),
}))
