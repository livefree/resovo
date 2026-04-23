import { create } from 'zustand'
import type { HostPlayerMode, PlayerHostOrigin, PersistedPlayerHostV1 } from '@/app/[locale]/_lib/player/types'
import type { MiniGeometryV1 } from './_persist/mini-geometry'
import { readMiniGeometry, writeMiniGeometry } from './_persist/mini-geometry'

export type { HostPlayerMode, PlayerHostOrigin } from '@/app/[locale]/_lib/player/types'
export type { MiniGeometryV1, MiniCorner } from './_persist/mini-geometry'

// PlayerMode 保留在本文件以维持原有导入路径
export type PlayerMode = 'default' | 'theater'

const STORAGE_KEY = 'resovo:player-host:v1'

const LEGAL_TRANSITIONS: Record<HostPlayerMode, HostPlayerMode[]> = {
  closed: ['full'],
  full:   ['closed', 'mini', 'pip'],
  mini:   ['closed', 'full', 'pip'],
  pip:    ['closed', 'full', 'mini'],
}

interface PlayerState {
  // === 既有字段 ===
  shortId: string | null
  currentEpisode: number
  isPlaying: boolean
  currentTime: number
  duration: number
  mode: PlayerMode

  // === M3-01 新增 ===
  hostMode: HostPlayerMode
  hostOrigin: PlayerHostOrigin | null
  isHydrated: boolean

  // === HANDOFF-03 新增：MiniPlayer 几何 + Takeover 护栏 ===
  // geometry：null = 未持久化或 hostMode!=mini/pip 不读；消费方 fallback 到 MINI_GEOMETRY_DEFAULTS
  geometry: MiniGeometryV1 | null
  // takeoverActive：Takeover 动画期间 MiniPlayer display:none 护栏（优先级最高）
  takeoverActive: boolean

  // === 既有 actions ===
  initPlayer: (shortId: string, episode: number) => void
  setEpisode: (episode: number) => void
  setPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setMode: (mode: PlayerMode) => void
  toggleMode: () => void

  // === M3-01 新增 actions ===
  setHostMode: (next: HostPlayerMode, origin?: PlayerHostOrigin) => void
  closeHost: () => void
  hydrateFromSession: () => void

  // === HANDOFF-03 新增 actions ===
  // setGeometry：仅在 drag-end / resize-end / close-mini 三事件点调用，同步 writeMiniGeometry 到 localStorage
  setGeometry: (geom: MiniGeometryV1) => void
  setTakeoverActive: (active: boolean) => void

  // === M5-CARD-CTA-01 新增 ===
  transition: 'fast-takeover' | 'standard-takeover' | null
  enter: (params: { shortId: string; slug: string | null; episode?: number; transition: 'fast-takeover' | 'standard-takeover' }) => void

  // === M5-CLEANUP-06 新增：选中线路 index，跨 mini↔full 切换持久 ===
  activeSourceIndex: number
  setActiveSourceIndex: (index: number) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  shortId: null,
  currentEpisode: 1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  mode: 'default',
  hostMode: 'closed',
  hostOrigin: null,
  isHydrated: false,
  geometry: null,
  takeoverActive: false,
  transition: null,
  activeSourceIndex: 0,

  setActiveSourceIndex: (index) => set({ activeSourceIndex: index }),

  initPlayer: (shortId, episode) =>
    set({ shortId, currentEpisode: episode, isPlaying: false, currentTime: 0, duration: 0, activeSourceIndex: 0 }),

  setEpisode: (episode) => set({ currentEpisode: episode, currentTime: 0 }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setMode: (mode) => set({ mode }),
  toggleMode: () =>
    set((s) => ({ mode: s.mode === 'default' ? 'theater' : 'default' })),

  setHostMode: (next, origin) => {
    const cur = get().hostMode
    if (cur === next) return
    if (!LEGAL_TRANSITIONS[cur].includes(next)) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
      console.warn(`[playerStore] illegal hostMode transition: ${cur} -> ${next}`)
      }
      return
    }
    set((s) => ({
      hostMode: next,
      hostOrigin:
        next === 'full' && origin
          ? origin
          : next === 'closed'
            ? null
            : s.hostOrigin,
      mode: next !== 'full' ? 'default' : s.mode,
    }))
    persistToSession(get())
  },

  closeHost: () => {
    get().setHostMode('closed')
  },

  enter: ({ shortId, slug, episode = 1, transition }) => {
    const urlSlug = slug ? `${slug}-${shortId}` : shortId
    set({
      shortId,
      currentEpisode: episode,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      transition,
    })
    get().setHostMode('full', { href: `/watch/${urlSlug}`, slug: urlSlug })
  },

  hydrateFromSession: () => {
    if (get().isHydrated) return
    // 1) sessionStorage 权威决定 hostMode（Storage 协调协议第一条）
    let nextHostMode: HostPlayerMode = 'closed'
    let sessionPatch: Partial<PlayerState> = {}
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedPlayerHostV1
        if (parsed.v === 1 && (parsed.hostMode === 'mini' || parsed.hostMode === 'pip')) {
          nextHostMode = parsed.hostMode
          sessionPatch = {
            hostMode: parsed.hostMode,
            shortId: parsed.shortId,
            currentEpisode: parsed.currentEpisode,
            hostOrigin: parsed.hostOrigin,
            isPlaying: false,
            currentTime: 0,
          }
        }
      }
    } catch {
      // sessionStorage unavailable or parse error — silently ignore
    }
    // 2) 仅在 hostMode=mini/pip 时读 localStorage 几何（Storage 协调协议第三条）；
    //    closed/full 时忽略 localStorage，避免 closed 态下误触发 mini 容器渲染。
    const geometry = (nextHostMode === 'mini' || nextHostMode === 'pip') ? readMiniGeometry() : null
    set({ ...sessionPatch, geometry, isHydrated: true })
  },

  setGeometry: (geom) => {
    set({ geometry: geom })
    writeMiniGeometry(geom)
  },
  setTakeoverActive: (active) => set({ takeoverActive: active }),
}))

function persistToSession(state: PlayerState) {
  try {
    if (state.hostMode === 'closed') {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    const payload: PersistedPlayerHostV1 = {
      v: 1,
      hostMode: state.hostMode as Exclude<HostPlayerMode, 'closed'>,
      shortId: state.shortId,
      currentEpisode: state.currentEpisode,
      hostOrigin: state.hostOrigin,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}
